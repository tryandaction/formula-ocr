import { describe, expect, it } from 'vitest';
import { queueFailureMessage, TaskQueue } from '../../utils/taskQueue';

describe('upload workspace queue', () => {
  it('bounds concurrency and settles cancelled queued work without starting it', async () => {
    const queue = new TaskQueue(1);
    let release!: () => void;
    const first = queue.add('first', async () => new Promise<void>(r => { release = r; }));
    let started = false;
    const second = queue.add('second', async () => { started = true; });
    queue.cancel('second');
    expect(await second).toMatchObject({ status: 'cancelled' });
    release();
    expect(await first).toMatchObject({ status: 'done' });
    expect(started).toBe(false);
  });
  it('rejects duplicate active jobs and releases a failed slot', async () => {
    const queue = new TaskQueue(1);
    const one = queue.add('one', async () => { throw new Error('failed'); });
    expect(await queue.add('one', async () => 2)).toMatchObject({ status: 'duplicate' });
    expect(await one).toMatchObject({ status: 'error' });
    expect(await queue.add('two', async () => 3)).toMatchObject({ status: 'done', value: 3 });
  });

  it('rejects work beyond the bounded capacity without starting it', async () => {
    const queue = new TaskQueue(1, 2);
    let release!: () => void;
    const first = queue.add('first', async () => new Promise<void>(resolve => { release = resolve; }));
    const second = queue.add('second', async () => undefined);
    let thirdStarted = false;

    await expect(queue.add('third', async () => { thirdStarted = true; })).resolves.toEqual({ status: 'queue_full' });

    release();
    await first;
    await second;
    expect(thirdStarted).toBe(false);
  });

  it('maps queue rejection to an actionable user message', () => {
    expect(queueFailureMessage({ status: 'queue_full' })).toBe('任务过多，请等待当前任务完成后重试');
    expect(queueFailureMessage({ status: 'duplicate' })).toBe('该任务已在队列中');
  });
});
