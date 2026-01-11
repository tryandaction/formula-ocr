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
const RETRY_DELAY_BASE = 1000; // 基础重试延迟（毫秒）
const CONCURRENT_LIMIT = 2; // 并发限制
const QUEUE_DELAY = 500; // 队列处理间隔

// 队列状态
let queue: QueueItem[] = [];
let processing = 0;
let isProcessing = false;

/**
 * 识别单个公式
 */
export async function recognizeFormula(
  formula: FormulaRegion,
  provider?: ProviderType
): Promise<OCRResult> {
  const selectedProvider = provider || getRecommendedProvider();
  
  try {
    const latex = await recognizeWithProvider(formula.imageData, selectedProvider);
    
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
