export interface PageDetection<T> { pageNumber: number; results: T[] }

export interface StreamingPagePipelineOptions<TPage, TOutput> {
  pageCount: number;
  loadPage: (pageNumber: number) => Promise<TPage>;
  processPage: (page: TPage, pageNumber: number) => Promise<TOutput>;
  releasePage: (page: TPage, pageNumber: number) => void | Promise<void>;
  signal?: AbortSignal;
}

export async function runStreamingPagePipeline<TPage, TOutput>({
  pageCount,
  loadPage,
  processPage,
  releasePage,
  signal,
}: StreamingPagePipelineOptions<TPage, TOutput>): Promise<TOutput[]> {
  const outputs: TOutput[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    signal?.throwIfAborted();
    const page = await loadPage(pageNumber);
    try {
      outputs.push(await processPage(page, pageNumber));
      signal?.throwIfAborted();
    } finally {
      await releasePage(page, pageNumber);
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return outputs;
}

export function passesConfidenceThreshold(confidence: number, threshold: number): boolean {
  if (!Number.isFinite(confidence) || confidence < 0) return false;
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  return normalized <= 1 && normalized >= threshold;
}

export async function runSequentialPageDetection<T>(
  pageImages: string[],
  detector: (image: string, pageNumber: number) => Promise<T[]>,
  signal?: AbortSignal,
  onPage?: (page: PageDetection<T>, completed: number, total: number) => void,
): Promise<Array<PageDetection<T>>> {
  const pages: Array<PageDetection<T>> = [];
  for (let index = 0; index < pageImages.length; index++) {
    signal?.throwIfAborted();
    const page = { pageNumber: index + 1, results: await detector(pageImages[index], index + 1) };
    signal?.throwIfAborted();
    pages.push(page);
    onPage?.(page, pages.length, pageImages.length);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return pages;
}
