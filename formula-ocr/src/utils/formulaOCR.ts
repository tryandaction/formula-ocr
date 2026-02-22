/**
 * 公式 OCR 服务
 * 封装智谱 API 调用，支持单个和批量公式识别
 */

import type { FormulaRegion } from './documentParser';
import { recognizeWithProvider, getRecommendedProvider, getSelectedProvider, getAvailableProviders, type ProviderType } from './providers';
import { checkBackendHealth, isBackendEnabled } from './api';
import { calculateOtsuThreshold } from './imageUtils';

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
  provider?: ProviderType;
}

// 配置
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const CONCURRENT_LIMIT = 4;
const QUEUE_DELAY = 200;
const BACKEND_HEALTH_TTL = 30_000;
const BACKEND_UNAVAILABLE_ERROR = '后端服务不可用或超时，请检查网络后重试';
const OCR_TIMEOUT_ERROR = '识别超时，请稍后重试';
const DEFAULT_OCR_TIMEOUT = 45_000;
const INVALID_LATEX_ERROR = '识别结果无效，请更换模型或提高图片清晰度';

let backendHealthCache: { ok: boolean; timestamp: number } | null = null;

const LOCAL_MIN_SIDE = 320;
const LOCAL_MAX_SIDE = 1024;
const LOCAL_PAD_RATIO = 0.12;
const LOCAL_PAD_MIN = 16;
const LOCAL_PAD_MAX = 64;

const FALLBACK_PRIORITY: ProviderType[] = [
  'zhipu',
  'gemini',
  'simpletex',
  'siliconflow',
  'qwen',
  'local',
  'anthropic',
  'openai',
];
const NO_FALLBACK_ERROR = '后端不可用，请配置免费 API（Gemini/智谱/SimpleTex）或使用本地模型';

const PROVIDER_TIMEOUTS: Partial<Record<ProviderType, number>> = {
  local: 120_000,
  backend: 60_000,
  zhipu: 60_000,
  gemini: 45_000,
  simpletex: 30_000,
  siliconflow: 45_000,
  qwen: 45_000,
  anthropic: 45_000,
  openai: 45_000,
};

async function resolveFallbackProvider(exclude: ProviderType[] = []): Promise<ProviderType | null> {
  const { providers } = await getAvailableProviders();
  for (const type of FALLBACK_PRIORITY) {
    if (exclude.includes(type)) continue;
    const candidate = providers.find(p => p.type === type);
    if (candidate?.isAvailable) {
      return type;
    }
  }
  return null;
}

// 队列状态
let queue: QueueItem[] = [];
let processing = 0;
let isProcessing = false;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getProviderTimeout(provider: ProviderType): number {
  return PROVIDER_TIMEOUTS[provider] ?? DEFAULT_OCR_TIMEOUT;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(OCR_TIMEOUT_ERROR));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });
}

function upscaleAndPadForLocal(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) return canvas;

  const minSide = Math.min(width, height);
  const maxSide = Math.max(width, height);
  let scale = 1;

  if (minSide < LOCAL_MIN_SIDE) {
    scale = LOCAL_MIN_SIDE / Math.max(1, minSide);
  }
  if (maxSide * scale > LOCAL_MAX_SIDE) {
    scale = LOCAL_MAX_SIDE / Math.max(1, maxSide);
  }

  const newWidth = Math.max(1, Math.round(width * scale));
  const newHeight = Math.max(1, Math.round(height * scale));
  const padBase = Math.min(newWidth, newHeight);
  const padding = clamp(Math.round(padBase * LOCAL_PAD_RATIO), LOCAL_PAD_MIN, LOCAL_PAD_MAX);

  const out = document.createElement('canvas');
  out.width = newWidth + padding * 2;
  out.height = newHeight + padding * 2;
  const outCtx = out.getContext('2d')!;
  outCtx.fillStyle = 'white';
  outCtx.fillRect(0, 0, out.width, out.height);
  const shouldSmooth = scale < 1;
  outCtx.imageSmoothingEnabled = shouldSmooth;
  if (shouldSmooth) {
    outCtx.imageSmoothingQuality = 'high';
  }
  outCtx.drawImage(canvas, 0, 0, width, height, padding, padding, newWidth, newHeight);
  return out;
}

function isLikelyLatex(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const rejectPhrases = [
    'image',
    'blurry',
    'cannot',
    "can't",
    'unable',
    'please',
    'sorry',
    'too small',
    '无法',
    '不能',
    '看不清',
    '模糊',
    '请提供',
    '无法识别',
  ];
  if (rejectPhrases.some(p => lower.includes(p))) return false;

  const hasMathToken = /[\\^_=+\-*/]|\\(frac|sqrt|sum|int|lim|cdot|alpha|beta|gamma|theta|pi)/.test(trimmed);
  const hasDigit = /\d/.test(trimmed);
  if (!hasMathToken && !hasDigit) {
    if (/^[^\s]{1,3}$/.test(trimmed)) return true;
    return false;
  }
  return true;
}

/**
 * 预处理公式图像：对比度增强 + 去噪 + 锐化
 * 不做二值化，AI 视觉模型需要灰度/彩色图像
 */
async function preprocessFormulaImage(imageBase64: string, provider?: ProviderType): Promise<string> {
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

    if (provider === 'local') {
      const enhanced = upscaleAndPadForLocal(canvas);
      const enhancedCtx = enhanced.getContext('2d')!;
      const enhancedData = enhancedCtx.getImageData(0, 0, enhanced.width, enhanced.height);
      const binarized = binarize(enhancedData);
      enhancedCtx.putImageData(binarized, 0, 0);
      return enhanced.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
  } catch {
    // 预处理失败时返回原图
    return imageBase64;
  }
}

async function isBackendHealthy(): Promise<boolean> {
  if (!isBackendEnabled()) return false;
  const now = Date.now();
  if (backendHealthCache && now - backendHealthCache.timestamp < BACKEND_HEALTH_TTL) {
    return backendHealthCache.ok;
  }
  const ok = await checkBackendHealth().catch(() => false);
  backendHealthCache = { ok, timestamp: now };
  return ok;
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

function binarize(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const threshold = calculateOtsuThreshold(data, width, height);
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const v = gray < threshold ? 0 : 255;
    result.data[i] = v;
    result.data[i + 1] = v;
    result.data[i + 2] = v;
    result.data[i + 3] = data[i + 3];
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
  const selectedProvider = provider || getSelectedProvider() || getRecommendedProvider();
  let activeProvider = selectedProvider;

  try {
    if (selectedProvider === 'backend') {
      const healthy = await isBackendHealthy();
      if (!healthy) {
        const fallback = await resolveFallbackProvider(['backend']);
        if (fallback) {
          activeProvider = fallback;
        } else {
          return {
            id: formula.id,
            latex: '',
            success: false,
            error: BACKEND_UNAVAILABLE_ERROR,
          };
        }
      }
    }

    // 预处理图像以提升识别质量
    const processedImage = await preprocessFormulaImage(formula.imageData, activeProvider);
    const latex = await withTimeout(
      recognizeWithProvider(processedImage, activeProvider),
      getProviderTimeout(activeProvider)
    );
    if (!isLikelyLatex(latex)) {
      const exclude: ProviderType[] = [activeProvider];
      if (activeProvider === 'backend') {
        exclude.push('backend');
      }
      const fallback = await resolveFallbackProvider(exclude);
      if (fallback) {
        const retryImage = await preprocessFormulaImage(formula.imageData, fallback);
        const retryLatex = await withTimeout(
          recognizeWithProvider(retryImage, fallback),
          getProviderTimeout(fallback)
        );
        if (!isLikelyLatex(retryLatex)) {
          throw new Error(INVALID_LATEX_ERROR);
        }
        return {
          id: formula.id,
          latex: retryLatex,
          markdown: `$$${retryLatex}$$`,
          success: true,
        };
      }
      throw new Error(activeProvider === 'backend' ? NO_FALLBACK_ERROR : INVALID_LATEX_ERROR);
    }
    
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
      if (lastError.message.includes('超时')) {
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('未知错误');
      if (lastError.message.includes('超时')) {
        break;
      }
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
        const result = await recognizeWithRetry(item.formula, MAX_RETRIES - item.retryCount, item.provider);
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
export function enqueueFormula(formula: FormulaRegion, provider?: ProviderType): Promise<OCRResult> {
  return new Promise((resolve, reject) => {
    queue.push({
      formula,
      resolve,
      reject,
      retryCount: 0,
      provider,
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

  let provider = getSelectedProvider() || getRecommendedProvider();
  if (provider === 'backend') {
    const healthy = await isBackendHealthy();
    if (!healthy) {
      const fallback = await resolveFallbackProvider(['backend']);
      if (fallback) {
        provider = fallback;
      } else {
        const failed = formulas.map(formula => ({
          id: formula.id,
          latex: '',
          success: false,
          error: NO_FALLBACK_ERROR,
        }));
        failed.forEach(result => {
          completed++;
          results.push(result);
          onProgress?.(completed, total, result);
        });
        return results;
      }
    }
  }
  
  // 创建所有 Promise
  const promises = formulas.map(formula => 
    enqueueFormula(formula, provider).then(result => {
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
