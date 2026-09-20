import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function boxIoU(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

export function evaluateDetection(truth, predicted, threshold = 0.5) {
  const matches = [];
  const usedTruth = new Set();
  const usedPredicted = new Set();
  const edges = [];
  for (let predictionIndex = 0; predictionIndex < predicted.length; predictionIndex++) {
    for (let truthIndex = 0; truthIndex < truth.length; truthIndex++) {
      if (predicted[predictionIndex].pageImage !== truth[truthIndex].pageImage) continue;
      const iou = boxIoU(predicted[predictionIndex].bbox, truth[truthIndex].bbox);
      if (iou >= threshold) edges.push({ predictionIndex, truthIndex, iou });
    }
  }
  edges.sort((a, b) => b.iou - a.iou);
  for (const edge of edges) {
    if (usedTruth.has(edge.truthIndex) || usedPredicted.has(edge.predictionIndex)) continue;
    usedTruth.add(edge.truthIndex);
    usedPredicted.add(edge.predictionIndex);
    matches.push({
      truthId: truth[edge.truthIndex].id,
      predictionIndex: edge.predictionIndex,
      iou: edge.iou,
    });
  }
  const tp = matches.length;
  const fp = predicted.length - tp;
  const fn = truth.length - tp;
  return {
    threshold,
    truthCount: truth.length,
    predictedCount: predicted.length,
    tp,
    fp,
    fn,
    precision: predicted.length ? tp / predicted.length : 0,
    recall: truth.length ? tp / truth.length : 0,
    meanMatchedIoU: tp ? matches.reduce((sum, match) => sum + match.iou, 0) / tp : 0,
    matches,
    missedTruthIds: truth.filter((_, index) => !usedTruth.has(index)).map(sample => sample.id),
    falsePositiveIndexes: predicted.map((_, index) => index).filter(index => !usedPredicted.has(index)),
  };
}

export function normalizeLatex(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\$+|\$+$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, '')
    .replace(/\s+/g, '');
}

export function evaluateOcr(truth, results, minimumSampleSize = 30, reviews = []) {
  const byId = new Map(results.map(result => [result.id, result]));
  const reviewById = new Map(reviews.map(review => [review.id, review]));
  const latexOf = result => Object.prototype.hasOwnProperty.call(result ?? {}, 'productLatex') ? result.productLatex : result?.latex;
  const scored = truth.filter(sample => sample.groundTruthLatex && byId.has(sample.id));
  const exact = scored.filter(sample => latexOf(byId.get(sample.id)) === sample.groundTruthLatex).length;
  const normalized = scored.filter(sample => normalizeLatex(latexOf(byId.get(sample.id))) === normalizeLatex(sample.groundTruthLatex)).length;
  const acceptable = scored.filter(sample => reviewById.get(sample.id)?.acceptable === true || byId.get(sample.id)?.humanAcceptable === true).length;
  const enough = scored.length >= minimumSampleSize;
  return {
    truthSamples: truth.length,
    scoredSamples: scored.length,
    exactCount: exact,
    normalizedCount: normalized,
    humanAcceptableCount: acceptable,
    exactMatch: enough ? exact / scored.length : '样本不足',
    normalizedMatch: enough ? normalized / scored.length : '样本不足',
    humanAcceptableRate: enough ? acceptable / scored.length : '样本不足',
    failures: scored
      .filter(sample => normalizeLatex(latexOf(byId.get(sample.id))) !== normalizeLatex(sample.groundTruthLatex))
      .map(sample => ({ id: sample.id, expected: sample.groundTruthLatex, actual: latexOf(byId.get(sample.id)) ?? '' })),
  };
}

function main() {
  const [, , manifestPath, detectionPath, ocrPath, reviewPath] = process.argv;
  if (!manifestPath) throw new Error('Usage: node evaluate-real-pdf.mjs <manifest> [detection-results] [ocr-results]');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const output = { benchmark: manifest.name, samples: manifest.samples.length };
  if (detectionPath && fs.existsSync(detectionPath)) {
    const predictions = JSON.parse(fs.readFileSync(detectionPath, 'utf8'));
    output.detection = evaluateDetection(manifest.samples, predictions);
  }
  if (ocrPath && fs.existsSync(ocrPath)) {
    const ocrResults = JSON.parse(fs.readFileSync(ocrPath, 'utf8'));
    const reviews = reviewPath && fs.existsSync(reviewPath) ? JSON.parse(fs.readFileSync(reviewPath, 'utf8')).reviews : [];
    output.ocr = evaluateOcr(manifest.samples, ocrResults, 30, reviews);
  }
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
