import fs from 'node:fs';

const [, , manifestPath = './fixtures/manifest.json', resultPath] = process.argv;
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const results = resultPath && fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, 'utf8')) : [];

const normalize = (value) => String(value || '')
  .replace(/\s+/g, '')
  .replace(/\$/g, '')
  .replace(/\\left|\\right/g, '');
const byId = new Map(results.map((result) => [result.id, result]));
const scored = manifest.samples.filter((sample) => sample.groundTruthLatex && byId.has(sample.id));
const exact = scored.filter((sample) => byId.get(sample.id)?.latex === sample.groundTruthLatex).length;
const normalized = scored.filter((sample) => normalize(byId.get(sample.id)?.latex) === normalize(sample.groundTruthLatex)).length;
const statusCounts = {};
for (const result of results) statusCounts[result.errorClass || (result.success ? 'success' : 'unknown')] = (statusCounts[result.errorClass || (result.success ? 'success' : 'unknown')] || 0) + 1;
const durations = results.map((result) => Number(result.processingTime)).filter(Number.isFinite).sort((a, b) => a - b);
const percentile = (items, p) => items.length ? items[Math.min(items.length - 1, Math.ceil(items.length * p) - 1)] : null;
const enough = scored.length >= 30;
console.log(JSON.stringify({
  samples: manifest.samples.length,
  scoredSamples: scored.length,
  exactMatch: enough ? exact / scored.length : '样本不足',
  normalizedMatch: enough ? normalized / scored.length : '样本不足',
  statusCounts,
  p50Ms: percentile(durations, 0.5),
  p95Ms: percentile(durations, 0.95),
  note: enough ? '仅统计有人工 ground truth 且有结果的样本' : '需要至少 30 个带人工 ground truth 的样本后才输出百分比',
}, null, 2));
