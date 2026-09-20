import { describe, expect, it, vi } from 'vitest';
import {
  passesConfidenceThreshold,
  runSequentialPageDetection,
  runStreamingPagePipeline,
} from '../../utils/pdfDetectionLifecycle';

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

  it('releases each high-resolution page before loading the next page', async () => {
    const events: string[] = [];
    const previews = await runStreamingPagePipeline({
      pageCount: 3,
      loadPage: async pageNumber => {
        events.push(`load:${pageNumber}`);
        return `high-resolution:${pageNumber}`;
      },
      processPage: async (page, pageNumber) => {
        events.push(`process:${pageNumber}:${page}`);
        return `preview:${pageNumber}`;
      },
      releasePage: (page, pageNumber) => events.push(`release:${pageNumber}:${page}`),
    });

    expect(previews).toEqual(['preview:1', 'preview:2', 'preview:3']);
    expect(events).toEqual([
      'load:1', 'process:1:high-resolution:1', 'release:1:high-resolution:1',
      'load:2', 'process:2:high-resolution:2', 'release:2:high-resolution:2',
      'load:3', 'process:3:high-resolution:3', 'release:3:high-resolution:3',
    ]);
  });

  it('normalizes fallback confidence before applying the configured threshold', () => {
    expect([0.48, 48, 0.82, 82].filter(value => passesConfidenceThreshold(value, 0.6))).toEqual([0.82, 82]);
  });
});
