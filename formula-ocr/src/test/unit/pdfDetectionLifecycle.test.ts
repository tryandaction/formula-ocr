import { describe, expect, it, vi } from 'vitest';
import { runSequentialPageDetection } from '../../utils/pdfDetectionLifecycle';

describe('PDF detection lifecycle', () => {
  it('waits for every page and reports completion once in page order', async () => {
    const events: number[] = [];
    const results = await runSequentialPageDetection(['a', 'b', 'c'], async (_page, number) => {
      events.push(number);
      return [{ id: String(number) }];
    });
    expect(events).toEqual([1, 2, 3]);
    expect(results.map(page => page.pageNumber)).toEqual([1, 2, 3]);
  });

  it('stops before starting another page after cancellation', async () => {
    const controller = new AbortController();
    const detector = vi.fn(async (_page: string, number: number) => {
      controller.abort();
      return [{ id: String(number) }];
    });
    await expect(runSequentialPageDetection(['a', 'b'], detector, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(detector).toHaveBeenCalledTimes(1);
  });
});
