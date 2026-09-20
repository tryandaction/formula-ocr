export type RuntimeStatus = 'queued' | 'preprocessing' | 'requesting' | 'parsing' | 'needs_review' | 'succeeded' | 'failed' | 'cancelled';

export interface RuntimeTask {
  formulaId: string;
  requestId: string;
  status: RuntimeStatus;
  attempt: number;
  errorClass?: string;
}

const TRANSITIONS: Record<RuntimeStatus, RuntimeStatus[]> = {
  queued: ['preprocessing', 'cancelled'],
  preprocessing: ['requesting', 'failed', 'cancelled'],
  requesting: ['parsing', 'failed', 'cancelled'],
  parsing: ['needs_review', 'succeeded', 'failed', 'cancelled'],
  needs_review: ['requesting', 'succeeded', 'cancelled'],
  succeeded: [],
  failed: ['queued'],
  cancelled: [],
};

export function createQueuedTask(formulaId: string, requestId: string): RuntimeTask {
  return { formulaId, requestId, status: 'queued', attempt: 0 };
}

export function transitionTask(task: RuntimeTask, next: RuntimeStatus, errorClass?: string): RuntimeTask {
  if (!TRANSITIONS[task.status].includes(next)) {
    throw new Error(`invalid transition: ${task.status} -> ${next}`);
  }
  return {
    ...task,
    status: next,
    attempt: next === 'requesting' ? task.attempt + 1 : task.attempt,
    ...(errorClass ? { errorClass } : {}),
  };
}

export function shouldRetry(errorClass: string, attempt: number, maxAttempts = 2): boolean {
  if (attempt >= maxAttempts) return false;
  if (['cancelled', 'quota', 'auth', 'rate_limit', 'invalid_latex', 'unsafe_output'].includes(errorClass)) return false;
  return ['network', 'timeout', 'provider_response'].includes(errorClass);
}

export function buildRecognitionCacheKey(input: {
  imageHash: string;
  formulaType: string;
  preprocessingVersion: string;
  provider: string;
  model: string;
}): string {
  return ['ocr', input.imageHash, input.formulaType, input.preprocessingVersion, input.provider, input.model].join(':');
}

export function orderRuntimeResults<T>(results: Array<{ index: number; value: T }>): T[] {
  return [...results].sort((a, b) => a.index - b.index).map(item => item.value);
}

const ERROR_MESSAGES: Record<string, string> = {
  model_unavailable: '本地模型不可用。请启动本地服务并确认公式模型已安装。',
  model_loading_failed: '本地模型加载失败。请检查模型文件和可用磁盘空间后重试。',
  queue_full: '任务过多，请等待当前任务完成后重试。',
  quota: '服务额度不足，请等待额度重置或切换已配置的服务。',
  rate_limit: '请求过于频繁，请稍后重试。',
  auth: '服务认证失败，请检查 API Key。',
  network: '网络或本地服务连接失败，请检查连接后重试。',
  timeout: '识别超时，请缩小选区或稍后重试。',
  invalid_output: '模型结果无效，请重新框选或换用其他服务。',
  invalid_latex: '结果不是有效 LaTeX，请重新框选或换用其他服务。',
  unsupported_format: '图片格式不受支持，请转换为 PNG、JPEG 或 WebP。',
  file_too_large: '输入过大，请压缩文件或缩小选区。',
  cancelled: '任务已取消。',
};

export function userErrorMessage(errorClass?: string, fallback?: string): string {
  return errorClass && ERROR_MESSAGES[errorClass] ? ERROR_MESSAGES[errorClass] : fallback || '识别失败，请重试。';
}
