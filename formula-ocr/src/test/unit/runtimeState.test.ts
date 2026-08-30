import { describe, expect, it } from 'vitest';
import { createQueuedTask, transitionTask, shouldRetry, buildRecognitionCacheKey, orderRuntimeResults } from '../../utils/runtimeState';

describe('OCR runtime state', () => {
  it('allows only explicit state transitions and preserves request identity', () => {
    const task = createQueuedTask('formula-1', 'request-1');
    expect(task.status).toBe('queued');
    expect(transitionTask(task, 'preprocessing').status).toBe('preprocessing');
    expect(transitionTask(transitionTask(task, 'preprocessing'), 'cancelled')).toMatchObject({
      formulaId: 'formula-1', requestId: 'request-1', status: 'cancelled',
    });
    expect(() => transitionTask(task, 'succeeded')).toThrow();
  });

  it('retries only transient failures and never retries cancellation or quota errors', () => {
    expect(shouldRetry('network', 0)).toBe(true);
    expect(shouldRetry('timeout', 2)).toBe(false);
    expect(shouldRetry('quota', 0)).toBe(false);
    expect(shouldRetry('cancelled', 0)).toBe(false);
    expect(shouldRetry('provider_response', 1)).toBe(true);
  });

  it('changes cache identity when provider, type, or preprocessing changes', () => {
    const base = { imageHash: 'img', formulaType: 'math', preprocessingVersion: 'v1', provider: 'zhipu', model: 'glm' };
    expect(buildRecognitionCacheKey(base)).not.toBe(buildRecognitionCacheKey({ ...base, provider: 'local' }));
    expect(buildRecognitionCacheKey(base)).not.toBe(buildRecognitionCacheKey({ ...base, formulaType: 'physics' }));
    expect(buildRecognitionCacheKey(base)).not.toBe(buildRecognitionCacheKey({ ...base, preprocessingVersion: 'v2' }));
  });

  it('orders batch results by input index instead of completion order', () => {
    expect(orderRuntimeResults([
      { index: 1, value: 'second' },
      { index: 0, value: 'first' },
    ])).toEqual(['first', 'second']);
  });
});
