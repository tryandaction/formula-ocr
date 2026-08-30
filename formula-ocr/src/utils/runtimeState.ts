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
