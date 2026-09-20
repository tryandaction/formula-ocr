import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boxIoU,
  evaluateDetection,
  evaluateOcr,
  normalizeLatex,
} from './evaluate-real-pdf.mjs';

test('boxIoU returns exact overlap and no overlap', () => {
  assert.equal(boxIoU({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 }), 1);
  assert.equal(boxIoU({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 5, height: 5 }), 0);
});

test('detection matching is one-to-one at the configured IoU threshold', () => {
  const truth = [
    { id: 'a', pageImage: 'page.png', bbox: { x: 0, y: 0, width: 10, height: 10 } },
    { id: 'b', pageImage: 'page.png', bbox: { x: 20, y: 0, width: 10, height: 10 } },
  ];
  const predicted = [
    { pageImage: 'page.png', bbox: { x: 0, y: 0, width: 10, height: 10 } },
    { pageImage: 'page.png', bbox: { x: 1, y: 1, width: 8, height: 8 } },
    { pageImage: 'page.png', bbox: { x: 20, y: 0, width: 10, height: 10 } },
  ];
  const result = evaluateDetection(truth, predicted, 0.5);
  assert.deepEqual({ tp: result.tp, fp: result.fp, fn: result.fn }, { tp: 2, fp: 1, fn: 0 });
  assert.equal(result.precision, 2 / 3);
  assert.equal(result.recall, 1);
});

test('LaTeX normalization removes cosmetic differences without changing structure', () => {
  assert.equal(normalizeLatex(' $ \\left( x + y \\right) $ '), '(x+y)');
  assert.notEqual(normalizeLatex('x^2'), normalizeLatex('x_2'));
});

test('OCR evaluation refuses to publish percentages below 30 paired samples', () => {
  const result = evaluateOcr(
    [{ id: 'a', groundTruthLatex: 'x' }],
    [{ id: 'a', latex: 'x', success: true }],
  );
  assert.equal(result.scoredSamples, 1);
  assert.equal(result.exactMatch, '样本不足');
  assert.equal(result.normalizedMatch, '样本不足');
});

test('OCR evaluation prefers the product-validated LaTeX when present', () => {
  const truth = Array.from({ length: 30 }, (_, index) => ({ id: String(index), groundTruthLatex: 'x' }));
  const results = truth.map(sample => ({ id: sample.id, latex: 'wrong', productLatex: 'x', productSuccess: true }));
  const result = evaluateOcr(truth, results);
  assert.equal(result.exactMatch, 1);
  assert.equal(result.normalizedMatch, 1);
});

test('OCR evaluation applies a separate human review without mutating raw results', () => {
  const truth = Array.from({ length: 30 }, (_, index) => ({ id: String(index), groundTruthLatex: 'x' }));
  const results = truth.map(sample => ({ id: sample.id, productLatex: 'wrong' }));
  const reviews = truth.map((sample, index) => ({ id: sample.id, acceptable: index < 3 }));
  const result = evaluateOcr(truth, results, 30, reviews);
  assert.equal(result.humanAcceptableCount, 3);
  assert.equal(result.humanAcceptableRate, 0.1);
});
