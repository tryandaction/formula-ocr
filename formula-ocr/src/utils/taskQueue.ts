export type QueueResult<T> =
  | { status: 'done'; value: T }
  | { status: 'error'; error: unknown }
  | { status: 'cancelled' }
  | { status: 'duplicate' }
  | { status: 'queue_full' };

export function queueFailureMessage(result: QueueResult<unknown>): string | undefined {
  if (result.status === 'queue_full') return '任务过多，请等待当前任务完成后重试';
  if (result.status === 'duplicate') return '该任务已在队列中';
  return undefined;
}

interface Job<T> {
  id: string;
  run: (signal: AbortSignal) => Promise<T>;
  controller: AbortController;
  resolve: (result: QueueResult<T>) => void;
}

/** Small cancellable queue shared by image and document OCR jobs. */
export class TaskQueue {
  private readonly queued: Job<unknown>[] = [];
  private readonly active = new Map<string, AbortController>();

  private readonly concurrency: number;
  private readonly capacity: number;

  constructor(concurrency = 3, capacity = 32) {
    if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('concurrency must be positive');
    if (!Number.isInteger(capacity) || capacity < concurrency) throw new Error('capacity must be at least concurrency');
    this.concurrency = concurrency;
    this.capacity = capacity;
  }

  add<T>(id: string, run: (signal: AbortSignal) => Promise<T>): Promise<QueueResult<T>> {
    if (this.active.has(id) || this.queued.some(job => job.id === id)) {
      return Promise.resolve({ status: 'duplicate' });
    }
    if (this.size >= this.capacity) return Promise.resolve({ status: 'queue_full' });
    return new Promise(resolve => {
      this.queued.push({ id, run, controller: new AbortController(), resolve } as Job<unknown>);
      this.pump();
    });
  }

  cancel(id: string): void {
    const index = this.queued.findIndex(job => job.id === id);
    if (index >= 0) {
      const [job] = this.queued.splice(index, 1);
      job.controller.abort(new DOMException('Cancelled', 'AbortError'));
      job.resolve({ status: 'cancelled' });
      return;
    }
    this.active.get(id)?.abort(new DOMException('Cancelled', 'AbortError'));
  }

  cancelAll(): void {
    for (const job of this.queued.splice(0)) {
      job.controller.abort(new DOMException('Cancelled', 'AbortError'));
      job.resolve({ status: 'cancelled' });
    }
    for (const controller of this.active.values()) controller.abort(new DOMException('Cancelled', 'AbortError'));
  }

  get size(): number { return this.queued.length + this.active.size; }

  private pump(): void {
    while (this.active.size < this.concurrency && this.queued.length) {
      const job = this.queued.shift()!;
      this.active.set(job.id, job.controller);
      job.run(job.controller.signal)
        .then(value => job.resolve(job.controller.signal.aborted ? { status: 'cancelled' } : { status: 'done', value }))
        .catch(error => job.resolve(job.controller.signal.aborted ? { status: 'cancelled' } : { status: 'error', error }))
        .finally(() => {
          this.active.delete(job.id);
          this.pump();
        });
    }
  }
}
