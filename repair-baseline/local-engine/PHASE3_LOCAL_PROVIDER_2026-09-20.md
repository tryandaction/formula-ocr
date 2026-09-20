# Phase 3 Local Provider Integration

Date: 2026-09-20

## Evidence and Root Cause

The previous `local.ts` checked only `/health`, posted `{image}` to `/recognize`, returned a plain string, and displayed unrelated Pix2Tex/Ollama setup instructions. The service contract implemented in Phase 1 uses `/v1/capabilities` and `/v1/recognize` with request id, MIME, formula type, mode, source metadata, structured result, engine, uncertainty, timing, and error class.

Single root-cause hypothesis confirmed: the frontend local Provider was wired to a nonexistent legacy protocol, so an installed companion service could not be selected or consumed correctly.

## Changes

- Local health now distinguishes unreachable service from reachable service with unavailable formula capability.
- Recognition sends the full request contract to `http://127.0.0.1:8502/v1/recognize`.
- Structured results preserve request id, engine, provider, service processing time, uncertainties, and error class.
- Structured success results still pass through the same conservative LaTeX/KaTeX validation as cloud responses.
- Model unavailable, model load failure, queue full, unsupported format, file too large, and page limit remain distinct error classes.
- The actual uv/Paddle setup command replaces the false Ollama instructions.
- Provider copy labels PP-FormulaNet-S as experimental and reports the measured 10/33 human-acceptable result instead of claiming high accuracy.
- The service capability endpoint reports the verified Apache-2.0 formula adapter as installed and lazy without loading its weights during health checks.

## Verification

| Command | Result |
|---|---|
| `npm run test:run -- localProvider/providerAdapter/providerContract` | 3 files, 16/16 tests passed |
| `npm run lint` | passed, no output |
| `npm run test:run` | 34 files, 264/264 tests passed |
| `npm run build` | passed, 76 modules transformed, Vite 8.06 s |
| `uv run pytest -q` | 31 passed, 1 model test skipped by default |
| `uv run ruff check .` | passed |
| `uv run mypy src/formula_ocr_engine` | passed for 14 source files |

## Actual Metrics and Remaining Risk

This phase does not change OCR accuracy. PP-FormulaNet-S original-input metrics remain product-valid 15/33, exact 0/33, normalized 0/33, human acceptable 10/33, P50 1235 ms, and P95 5340 ms on the current machine. The local Provider remains opt-in and not recommended. Formula detection is still the legacy baseline until the next phase; no cloud fallback occurs automatically.
