export interface PageDetection<T> { pageNumber: number; results: T[] }

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
