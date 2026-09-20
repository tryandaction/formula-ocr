# Formula OCR Repair Baseline

This directory contains versioned, privacy-safe observations for the repair
program. It does not contain private user documents, API keys, or model
transcripts. The synthetic PDF and failure sample referenced by the manifest
are versioned under `formula-ocr/output/playwright/pdf-benchmark` so the current
small baseline can be reproduced.

## Scope

- `PHASE0_BASELINE.md`: command exit codes and observed failures.
- `DATA_FLOW.md`: input/output fields at each frontend and Worker boundary.
- `DIAGNOSTIC_SCHEMA.md`: opt-in metadata-only event schema.
- `fixtures/manifest.json`: eight generator-derived formulas with manually
  checked LaTeX ground truth and one unresolved failure sample.
- `evaluate.mjs`: reports OCR exact/normalized match only after at least 30
  scored samples; until then it prints `样本不足`.
- `fixtures/real-pdf-v1/`: 33 formula crops from three real physics papers,
  human LaTeX and box ground truth, raw Provider results, human review, and a
  reproducible evaluator. See its README for the measured v1 results.

The original synthetic manifest has no ground-truth detection boxes. Detection
metrics must use `real-pdf-v1`; its small scope still does not establish general
production accuracy.
