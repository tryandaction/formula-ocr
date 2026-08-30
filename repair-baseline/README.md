# Formula OCR Repair Baseline

This directory contains versioned, privacy-safe observations for the repair
program. It does not contain original user documents, complete image payloads,
API keys, or model transcripts. Derived benchmark artifacts remain under the
existing `formula-ocr/output/playwright/pdf-benchmark` directory and are only
summarized here.

## Scope

- `PHASE0_BASELINE.md`: command exit codes and observed failures.
- `DATA_FLOW.md`: input/output fields at each frontend and Worker boundary.
- `DIAGNOSTIC_SCHEMA.md`: opt-in metadata-only event schema.
- `fixtures/manifest.json`: the initial benchmark manifest. Ground truth is
  intentionally empty until a human reviewer verifies each formula.
