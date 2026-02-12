/**
 * Shared image processing utilities.
 */

/**
 * Calculate Otsu's threshold for automatic binarization.
 * Works on raw RGBA pixel data (Uint8ClampedArray from ImageData).
 */
export function calculateOtsuThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number {
  const histogram = new Array<number>(256).fill(0);
  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[gray]++;
  }

  // Normalized histogram
  let maxVariance = 0;
  let threshold = 128;

  // Cumulative sums for O(n) Otsu
  let w0 = 0;
  let sum0 = 0;
  let totalSum = 0;
  for (let i = 0; i < 256; i++) totalSum += i * histogram[i];

  for (let t = 0; t < 256; t++) {
    w0 += histogram[t];
    if (w0 === 0) continue;
    const w1 = total - w0;
    if (w1 === 0) break;

    sum0 += t * histogram[t];
    const mu0 = sum0 / w0;
    const mu1 = (totalSum - sum0) / w1;
    const variance = w0 * w1 * (mu0 - mu1) * (mu0 - mu1);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  return threshold;
}
