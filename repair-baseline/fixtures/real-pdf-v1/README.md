# Real PDF Formula Benchmark v1

This benchmark was created from three papers in the user's local `Categorized Papers` library. It contains 33 formula crops with human-transcribed LaTeX ground truth across ten evaluated pages. Ground truth was frozen before any Provider OCR run.

## Reproduce fixtures

```powershell
./render-pages.ps1
./crop-fixtures.ps1
node ../../evaluate-real-pdf.mjs manifest.json detection-results.json ocr-product-results-strict-prompt.json human-review-strict-prompt.json
```

`render-pages.ps1` verifies each source PDF by SHA-256 before rendering at 120 DPI. Full papers are not copied into this repository. `crops/` contains only the small formula regions used for OCR evaluation.

## Metrics

Detection uses one-to-one box matching at IoU >= 0.5. OCR reports exact match, whitespace/wrapper-normalized match, and manually reviewed acceptability. The evaluator refuses to publish OCR percentages with fewer than 30 paired results.

Current visual-detector baseline for commit `e84bbbc`:

- Ground-truth boxes: 33
- Predicted boxes: 89
- TP / FP / FN: 6 / 83 / 27
- Precision: 0.0674
- Recall: 0.1818
- Mean IoU among matched boxes: 0.6766

This visual result measures the raster-page detector directly. The product normally routes text-layer PDF pages through text extraction instead; the number must not be presented as end-to-end PDF OCR accuracy.

Current OCR baseline for `glm-4v-flash` with JSON mode and the strict transcription prompt:

- Ground-truth formulas: 33
- Provider JSON responses accepted by the benchmark runner: 33/33
- Product-validated/displayable results: 23/33 (0.6970)
- Exact match: 0/33
- Strict normalized match: 0/33
- Human-acceptable mathematical transcription: 3/33 (0.0909)
- Request latency in this run: P50 1321ms, P95 2711ms (not an SLA)

`response_format: {"type":"json_object"}` improved Provider JSON validity from 24/33 to 33/33 and product displayability from 16/33 to 23/33. It did not materially solve symbol transcription accuracy. A dedicated `glm-ocr` request was attempted but the configured account returned HTTP 429 for insufficient balance/resources, so no GLM-OCR accuracy claim is made.

## Limits

- Three papers are not representative of all publishers, scans, handwriting, chemistry, or languages.
- Equation numbers are inside some detection boxes but excluded from the LaTeX transcription.
- This v1 OCR result measures one legacy free visual model under one API account and one run; model nondeterminism remains.
- The exact and normalized metrics are intentionally strict. Human acceptability is separately reviewed and versioned.
