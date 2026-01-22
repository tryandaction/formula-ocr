/**
 * 整页公式识别系统 - 错误类定义
 * 
 * 本文件定义了系统中可能出现的各种错误类型。
 * 这些错误类用于更精确地描述和处理不同的错误场景。
 */

/**
 * 无效页面数据错误
 * 当输入的PDF页面数据无效时抛出
 */
export class InvalidPageDataError extends Error {
  constructor(message: string) {
    super(`Invalid page data: ${message}`);
    this.name = 'InvalidPageDataError';
  }
}

/**
 * 检测错误
 * 当公式检测过程失败时抛出
 */
export class DetectionError extends Error {
  /** 错误是否可恢复（可以尝试降级方案） */
  public readonly recoverable: boolean;

  constructor(message: string, recoverable: boolean = true) {
    super(`Detection failed: ${message}`);
    this.name = 'DetectionError';
    this.recoverable = recoverable;
  }
}

/**
 * 格式转换错误
 * 当公式格式转换失败时抛出
 */
export class ConversionError extends Error {
  /** 公式ID */
  public readonly formulaId: string;
  /** 目标格式 */
  public readonly targetFormat: 'latex' | 'markdown';

  constructor(
    message: string,
    formulaId: string,
    targetFormat: 'latex' | 'markdown'
  ) {
    super(`Conversion to ${targetFormat} failed: ${message}`);
    this.name = 'ConversionError';
    this.formulaId = formulaId;
    this.targetFormat = targetFormat;
  }
}

/**
 * 性能错误类型
 */
export type PerformanceErrorType = 'timeout' | 'memory' | 'resource';

/**
 * 性能错误
 * 当系统遇到性能问题时抛出
 */
export class PerformanceError extends Error {
  /** 错误类型 */
  public readonly errorType: PerformanceErrorType;

  constructor(message: string, errorType: PerformanceErrorType) {
    super(`Performance issue: ${message}`);
    this.name = 'PerformanceError';
    this.errorType = errorType;
  }
}

/**
 * 剪贴板错误
 * 当剪贴板操作失败时抛出
 */
export class ClipboardError extends Error {
  /** 失败原因 */
  public readonly reason: string;

  constructor(message: string, reason: string) {
    super(`Clipboard operation failed: ${message}`);
    this.name = 'ClipboardError';
    this.reason = reason;
  }
}

/**
 * 降级链配置
 * 用于实现降级策略
 */
export interface FallbackChain<T> {
  /** 主要方法 */
  primary: () => Promise<T>;
  /** 降级方法数组 */
  fallbacks: Array<() => Promise<T>>;
  /** 错误回调（可选） */
  onError?: (error: Error, attemptIndex: number) => void;
}

/**
 * 执行带降级的操作
 * 如果主要方法失败，依次尝试降级方法
 * 
 * @param chain - 降级链配置
 * @returns 执行结果
 * @throws 如果所有方法都失败，抛出最后一个错误
 */
export async function executeWithFallback<T>(
  chain: FallbackChain<T>
): Promise<T> {
  const methods = [chain.primary, ...chain.fallbacks];

  for (let i = 0; i < methods.length; i++) {
    try {
      return await methods[i]();
    } catch (error) {
      chain.onError?.(error as Error, i);

      if (i === methods.length - 1) {
        throw error; // 所有方法都失败
      }
    }
  }

  throw new Error('Unexpected fallback chain completion');
}

/**
 * 延迟函数
 * 用于实现指数退避
 * 
 * @param ms - 延迟毫秒数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的执行
 * 如果操作失败，使用指数退避策略重试
 * 
 * @param operation - 要执行的操作
 * @param maxRetries - 最大重试次数
 * @param initialDelay - 初始延迟（毫秒）
 * @returns 执行结果
 * @throws 如果所有重试都失败，抛出最后一个错误
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await delay(initialDelay * Math.pow(2, i)); // 指数退避
    }
  }

  throw new Error('Unexpected retry completion');
}

/**
 * 带超时的执行
 * 如果操作超时，抛出PerformanceError
 * 
 * @param operation - 要执行的操作
 * @param timeoutMs - 超时时间（毫秒）
 * @returns 执行结果
 * @throws PerformanceError 如果超时
 */
export async function executeWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new PerformanceError('Operation timeout', 'timeout'));
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]);
}

/**
 * 内存监控
 * 检查内存使用情况，如果超过阈值则触发清理
 * 
 * @param memoryLimitMB - 内存限制（MB）
 * @param onExceed - 超过限制时的回调
 */
export function monitorMemory(
  memoryLimitMB: number = 500,
  onExceed?: () => void
): void {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const usedMemoryMB = memory.usedJSHeapSize / (1024 * 1024);

    if (usedMemoryMB > memoryLimitMB) {
      console.warn(
        `Memory usage (${usedMemoryMB.toFixed(2)}MB) exceeds limit (${memoryLimitMB}MB)`
      );
      onExceed?.();
    }
  }
}
