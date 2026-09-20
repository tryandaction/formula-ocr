# Phase 4 Local Document Jobs

Date: 2026-09-20

## Implemented Contract

- `POST /v1/jobs/documents` validates multipart MIME, `%PDF-` magic bytes, and the 50 MB byte limit before creating a job.
- `GET /v1/jobs/{id}` returns queued/running/completed/failed/cancelled state, progress, Markdown, formulas, and stable errors.
- `DELETE /v1/jobs/{id}` marks cancellation immediately.
- One worker processes jobs serially. Cancellation prevents a late completed result from being published.
- Temporary PDFs are removed in `finally`; `wait()` does not return until cleanup completes.
- The job manager is model-agnostic and has deterministic fake-engine tests.

## Document Engine Investigation

Pix2Text 1.1.7 was evaluated for `recognize_pdf()`:

1. Its default locked stack resolved `transformers 4.57.6`, for which the current `pip-audit` database reported eight known vulnerabilities.
2. Constraining to a current safe Transformers 5.x release resolved and installed, but importing Pix2Text failed because its resolved `optimum 1.17.1` imports a Transformers API removed in 5.x (`is_tf_available`).
3. The safe and compatible intersection was therefore not demonstrated.

Per the release/security stop condition, no Pix2Text document adapter is enabled. The default job upload returns `503 model_unavailable`; test injection proves the job protocol without misrepresenting a fake engine as PDF-to-Markdown support. The existing browser PDF text-layer/render/manual-selection workflow remains the supported product path.

## Verification

| Command | Result |
|---|---|
| Job cancellation/cleanup tests | 2/2 passed |
| Multipart/job API tests | 2/2 passed |
| `uv run pytest -q` | 40 passed, 2 model tests skipped by default |
| `uv run ruff check .` | passed |
| `uv run mypy src/formula_ocr_engine` | passed for 18 source files |
| `uv run pip-audit` | no known vulnerabilities; local unpublished package skipped |

## Remaining Risk and Next Entry

- There is no enabled local PDF-to-Markdown model, no model-backed Markdown quality metric, and no long-document memory result for such a model.
- Job queue capacity/overflow and retention expiry remain Phase 6 work.
- A future document adapter must prove a compatible audited dependency set, real PDF output, cancellation boundaries, and long-document memory before capability becomes available.
