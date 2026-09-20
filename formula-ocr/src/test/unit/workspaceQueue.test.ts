import { describe, expect, it } from 'vitest';
import { TaskQueue } from '../../utils/taskQueue';

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
});
