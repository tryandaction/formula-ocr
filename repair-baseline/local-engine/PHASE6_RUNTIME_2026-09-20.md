# Phase 6 Runtime Reliability

Date: 2026-09-20

## Implemented Behavior

- Frontend queue capacity defaults to 32 tasks with explicit `queue_full`; concurrency remains independently bounded.
- Duplicate, cancelled, failed, and queue-full outcomes are distinct.
- Queue rejection updates file/formula UI to a terminal failed state with an actionable message instead of leaving “处理中/识别中”.
- Python PDF jobs use one worker and capacity 8 by default. Capacity counts queued plus running jobs.
- Python rejects overflow before creating a temporary PDF and the API returns HTTP 429 with `errorClass: queue_full`.
- Cancelled jobs never publish a later completed result; temporary files are deleted before `wait()` returns.
- Existing retry logic remains allow-list based (`network`, `timeout`, `provider_response` only); cancellation, quota, authentication, invalid output, model unavailability, and queue full do not retry.
- Existing cache identity already contains image hash, formula type, preprocessing version, Provider, and model.
- Local Provider calls do not enter Worker quota/payment paths.

## Verification

| Command | Result |
|---|---|
| Queue/workbench targeted tests | 2 files, 10/10 passed |
| Python job/API targeted tests | 6/6 passed |
| Frontend full tests | 34 files, 267/267 passed |
| Frontend lint/build | passed; Vite build 7.84 s |
| Python full tests | 42 passed, 2 model tests skipped by default |
| Python Ruff/mypy/audit | all passed; no known vulnerabilities |
| Worker typecheck | passed |

## Remaining Work

- Completed document-job retention/expiry is not user-facing while document capability remains disabled; it remains future work before enabling a document model.
- Real cloud quota/payment recovery is unchanged and was regression checked, not exercised against production billing.
- Phase 7 must verify distinct queue-full, model-loading, no-formula, invalid-output, cancelled, and success presentation in browser flows.
