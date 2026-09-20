# Local OCR Engine Phase 0 Baseline

Date: 2026-09-20

Checkout: `3d0c54291ff1c1efd8e628e9318fa7b0214c3586`

Scope: evidence collection only; no product implementation changed.

## Current Evidence

### Worktree protection

`git status --short` reported only pre-existing untracked planning, Playwright output, baseline output, logs, and temporary directories. Neither protected file had a diff:

- `formula-ocr/src/utils/advancedFormulaDetection/interfaces.ts`
- `formula-ocr/src/utils/wholePageRecognition/types.ts`

Those files remain outside the allowed edit set for the local-engine work.

### Quality commands

| Command | Exit | Observed result |
|---|---:|---|
| `formula-ocr: npm run lint` | 0 | ESLint completed with no reported error or warning; wall time 25.34 s. |
| `formula-ocr: npm run test:run` | 0 | 33 test files passed; 260/260 tests passed; Vitest duration 33.15 s. |
| `formula-ocr: npm run build` | 0 | TypeScript and Vite production build passed; 76 modules transformed; Vite build 8.94 s, command wall time 20.92 s. |
| `formula-ocr: npm audit --omit=dev --audit-level=high` | 1 | Configured `npmmirror` returned 404 because it does not implement the npm audit endpoint. This is not a vulnerability result. |
| `formula-ocr: npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org/` | 0 | `found 0 vulnerabilities`; wall time 2.13 s. |
| `formula-ocr-worker: npx tsc --noEmit` | 0 | Worker TypeScript check passed; wall time 5.21 s. |
| `formula-ocr-worker: npm audit --omit=dev --audit-level=high` | 0 | `found 0 vulnerabilities`; wall time 3.14 s. |
| `node --test repair-baseline/evaluate-real-pdf.test.mjs` | 0 | 6/6 evaluator tests passed; duration 67.80 ms. |

### Existing benchmark replay

Command inputs:

- Ground truth: `repair-baseline/fixtures/real-pdf-v1/manifest.json`
- Detection result: `repair-baseline/fixtures/real-pdf-v1/detection-results.json`
- OCR result: `repair-baseline/fixtures/real-pdf-v1/ocr-product-results-json-mode-v2.json`
- Human review: `repair-baseline/fixtures/real-pdf-v1/human-review-json-mode.json`

Detection at IoU 0.5:

| Metric | Value |
|---|---:|
| Ground-truth boxes | 33 |
| Predicted boxes | 89 |
| TP / FP / FN | 6 / 83 / 27 |
| Precision | 6.74% |
| Recall | 18.18% |
| Mean IoU of matched boxes | 0.6766 |

OCR for the historical GLM result, not the new local engine:

| Metric | Value |
|---|---:|
| Ground-truth/scored formulas | 33 / 33 |
| Exact match | 0/33 (0%) |
| Strict normalized match | 0/33 (0%) |
| Human acceptable | 2/33 (6.06%) |

`PROJECT_STATUS.md` and `RELEASE_NOTES.md` currently report 3/33 (9.09%) from a different historical result/review pairing. The current reproducible command above reports 2/33. Phase 8 must name the exact input files for every published metric and remove the ambiguity. No local PaddleOCR or Pix2Text accuracy exists yet.

## Single Root-Cause Hypothesis

The active frontend contract is substantially repaired, but the `local` Provider has no real companion service and violates the contract by sending only `{image}` to `/recognize`. Therefore the product has no dedicated, measurable, local formula OCR path; prompt and UI changes cannot fix this missing capability boundary.

## Allowed Files for the Next Phase

- New files under `formula-ocr-engine/`.
- New evidence under `repair-baseline/local-engine/`.
- No frontend, Worker, benchmark ground-truth, or protected-file edits during the service-contract task.

## Failing-Test Plan

Phase 1 starts with contract tests proving that `/health` does not load model weights, `/v1/capabilities` exposes explicit limits/licenses, and `/v1/recognize` fails with `model_unavailable` before an engine is installed. The tests must fail because the service package and routes do not exist, then pass after the minimal FastAPI contract is implemented.

## Stop Condition

Phase 0 is complete because command evidence, protected-file status, current detection/OCR metrics, the missing-service boundary, allowed edit scope, and the first failing-test target are reproducible. Any later inability to resolve a Python 3.11 model dependency or verify a weight license stops that adapter rather than weakening the gate.
