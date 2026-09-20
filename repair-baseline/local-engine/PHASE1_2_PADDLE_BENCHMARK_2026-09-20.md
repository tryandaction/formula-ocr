# Phase 1/2 PP-FormulaNet-S Benchmark

Date: 2026-09-20
Machine: Windows, Intel i7-12700H, 16 GB RAM, CPU inference
Runtime: Python 3.11.15, PaddleOCR 3.7.0, PaddlePaddle 3.3.1, PaddleX 3.7.2
Model: PP-FormulaNet-S, cached official weights
Dataset: `real-pdf-formulas-v1`, 33 human-transcribed formula crops from three physics papers

## Commands

```powershell
$env:RUN_MODEL_TESTS='1'
uv run python "scripts/run_formula_benchmark.py" `
  --manifest "../repair-baseline/fixtures/real-pdf-v1/manifest.json" `
  --crop-root "../repair-baseline/fixtures/real-pdf-v1" `
  --variants original,upscale,grayscale,binary `
  --output "../repair-baseline/local-engine/paddle-pp-formulanet-s-variants.json"

node "repair-baseline/evaluate-real-pdf.mjs" `
  "repair-baseline/fixtures/real-pdf-v1/manifest.json" `
  "repair-baseline/fixtures/real-pdf-v1/detection-results.json" `
  "repair-baseline/local-engine/paddle-pp-formulanet-s-results.json" `
  "repair-baseline/local-engine/paddle-pp-formulanet-s-human-review.json"
```

The evaluator compatibility test has 7/7 passing cases. Ground truth was not modified.

## OCR and Runtime Results

| Variant | Engine non-empty | Product-valid KaTeX | Exact | Strict normalized | Human acceptable | P50 | P95 | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| original | 33/33 | 15/33 | 0/33 | 0/33 | 10/33 (30.30%) | 1235 ms | 5340 ms | 5435 ms |
| upscale 2x | 33/33 | 16/33 | 0/33 | 0/33 | not reviewed | 1194 ms | 5586 ms | 6385 ms |
| grayscale | 33/33 | 15/33 | 0/33 | 0/33 | not reviewed | 1119 ms | 2011 ms | 5580 ms |
| Otsu binary | 33/33 | 12/33 | 0/33 | 0/33 | not reviewed | 1164 ms | 5358 ms | 5452 ms |

“Engine non-empty” means Paddle returned a string. It is not a success or accuracy metric. “Product-valid” applies the current frontend safety checks and KaTeX parser; it also is not mathematical correctness.

The original human review accepts cosmetic LaTeX differences and removable equation numbers, but rejects missing terms, changed indices, malformed structures, and symbol substitutions. The review file contains a decision and reason for every sample.

## Error Patterns

- Equation numbers are frequently included in the LaTeX and sometimes inserted into the formula body.
- Long and multi-line formulas can degenerate into repeated slashes or malformed environments.
- Bra-ket notation is often rendered with malformed `right>`/`rangle` sequences.
- Small indices such as `l` versus `I`, summation lower bounds, and Greek symbols are frequently wrong.
- Some semantically close results fail KaTeX because of malformed environment delimiters or suffixes.

## Decisions and Stop Conditions

- Keep `original` as the default preprocessing variant. No derived variant improved exact or normalized accuracy, and only original has completed human review.
- Keep the local Paddle adapter opt-in and not recommended. It misses the product-valid gate (15/33 versus 30/33), the human-acceptable gate (10/33 versus 24/33), and the CPU P95 gate (5340 ms versus 5000 ms).
- Do not add heuristic equation-number stripping yet. Several outputs embed the number inside malformed formula structure, so a string suffix rule would hide only one symptom.
- Detection metrics remain the legacy raster detector's separate 6.74% precision and 18.18% recall until the Pix2Text detector task runs.
- These measurements apply only to this model, runtime, machine, and 33-sample benchmark. They do not establish general physics, mathematics, chemistry, scan, or handwriting accuracy.
