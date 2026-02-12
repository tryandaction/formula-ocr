/**
 * 公式 OCR 服务
 * 封装智谱 API 调用，支持单个和批量公式识别
 */

import type { FormulaRegion } from './documentParser';
import { recognizeWithProvider, getRecommendedProvider, type ProviderType } from './providers';

// OCR 结果类型
export interface OCRResult {
  id: string;
  latex: string;
  markdown?: string;
  success: boolean;
  error?: string;
}

// OCR 队列项
interface QueueItem {
  formula: FormulaRegion;
  resolve: (result: OCRResult) => void;
  reject: (error: Error) => void;
  retryCount: number;
}

// 配置
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const CONCURRENT_LIMIT = 4;
const QUEUE_DELAY = 200;

// 队列状态
let queue: QueueItem[] = [];
let processing = 0;
let isProcessing = false;

/**
 * 预处理公式图像：对比度增强 + 去噪 + 锐化
 * 不做二值化，AI 视觉模型需要灰度/彩色图像
 */
async function preprocessFormulaImage(imageBase64: string): Promise<string> {
  try {
    const img = await loadImageElement(imageBase64);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 1. 对比度增强（直方图均衡化 - 灰度通道）
    imageData = enhanceContrast(imageData);

    // 2. 去噪（3x3 中值滤波）
    imageData = denoise(imageData);

    // 3. 锐化（卷积核）
    imageData = sharpen(imageData);

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    // 预处理失败时返回原图
    return imageBase64;
  }
}

function loadImageElement(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  });
}

function enhanceContrast(imageData: ImageData): ImageData {
  const data = imageData.data;
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[gray]++;
  }
  const total = imageData.width * imageData.height;
  const cdf = new Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + histogram[i];
  const cdfMin = cdf.find(v => v > 0) || 0;
  const scale = 255 / Math.max(1, total - cdfMin);

  const result = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const eq = Math.round((cdf[gray] - cdfMin) * scale);
    const ratio = gray > 0 ? eq / gray : 1;
    result.data[i] = Math.min(255, Math.round(data[i] * ratio));
    result.data[i + 1] = Math.min(255, Math.round(data[i + 1] * ratio));
    result.data[i + 2] = Math.min(255, Math.round(data[i + 2] * ratio));
    result.data[i + 3] = data[i + 3];
  }
  return result;
}

function denoise(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const values: number[] = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            values.push(data[((y + dy) * width + (x + dx)) * 4 + c]);
          }
        }
        values.sort((a, b) => a - b);
        result.data[(y * width + x) * 4 + c] = values[4]; // median
      }
    }
  }
  return result;
}

function sharpen(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += data[((y + dy) * width + (x + dx)) * 4 + c] * kernel[ki++];
          }
        }
        result.data[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, sum));
      }
    }
  }
  return result;
}

/**
 * 识别单个公式
 */
export async function recognizeFormula(
  formula: FormulaRegion,
  provider?: ProviderType
): Promise<OCRResult> {
  const selectedProvider = provider || getRecommendedProvider();

  try {
    // 预处理图像以提升识别质量
    const processedImage = await preprocessFormulaImage(formula.imageData);
    const latex = await recognizeWithProvider(processedImage, selectedProvider);
    
    return {
      id: formula.id,
      latex,
      markdown: `$$${latex}$$`,
      success: true,
    };
  } catch (error) {
    return {
      id: formula.id,
      latex: '',
      success: false,
      error: error instanceof Error ? error.message : '识别失败',
    };
  }
}

/**
 * 带重试的公式识别
 */
async function recognizeWithRetry(
  formula: FormulaRegion,
  maxRetries: number = MAX_RETRIES,
  provider?: ProviderType
): Promise<OCRResult> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await recognizeFormula(formula, provider);
      if (result.success) {
        return result;
      }
      lastError = new Error(result.error || '识别失败');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('未知错误');
    }
    
    // 指数退避
    if (attempt < maxRetries - 1) {
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return {
    id: formula.id,
    latex: '',
    success: false,
    error: lastError?.message || '识别失败，已达最大重试次数',
  };
}

/**
 * 处理队列
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  
  while (queue.length > 0 && processing < CONCURRENT_LIMIT) {
    const item = queue.shift();
    if (!item) break;
    
    processing++;
    
    // 异步处理，不阻塞队列
    (async () => {
      try {
        const result = await recognizeWithRetry(item.formula, MAX_RETRIES - item.retryCount);
        item.resolve(result);
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error('未知错误'));
      } finally {
        processing--;
        // 延迟处理下一个，避免请求过快
        setTimeout(() => processQueue(), QUEUE_DELAY);
      }
    })();
  }
  
  isProcessing = false;
}

/**
 * 将公式加入识别队列
 */
export function enqueueFormula(formula: FormulaRegion): Promise<OCRResult> {
  return new Promise((resolve, reject) => {
    queue.push({
      formula,
      resolve,
      reject,
      retryCount: 0,
    });
    processQueue();
  });
}

/**
 * 批量识别公式
 */
export async function recognizeFormulas(
  formulas: FormulaRegion[],
  onProgress?: (completed: number, total: number, result: OCRResult) => void
): Promise<OCRResult[]> {
  const results: OCRResult[] = [];
  const total = formulas.length;
  let completed = 0;
  
  // 创建所有 Promise
  const promises = formulas.map(formula => 
    enqueueFormula(formula).then(result => {
      completed++;
      results.push(result);
      onProgress?.(completed, total, result);
      return result;
    })
  );
  
  // 等待所有完成
  await Promise.all(promises);
  
  return results;
}

/**
 * 清空队列
 */
export function clearQueue(): void {
  queue.forEach(item => {
    item.reject(new Error('队列已清空'));
  });
  queue = [];
}

/**
 * 获取队列状态
 */
export function getQueueStatus(): { pending: number; processing: number } {
  return {
    pending: queue.length,
    processing,
  };
}

/**
 * 检查是否有正在处理的任务
 */
export function isQueueBusy(): boolean {
  return queue.length > 0 || processing > 0;
}
