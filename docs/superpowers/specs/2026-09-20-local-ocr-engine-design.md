# Local Formula OCR Engine Design

Date: 2026-09-20
Status: Proposed

## 1. Goal

Add a self-hosted, zero-per-request-cost OCR engine that makes formula image recognition and PDF-to-Markdown processing work without sending user documents to a third-party Provider. The engine must be measurable against the versioned formula benchmark and must not become the default until it passes explicit quality gates.

## 2. Constraints

- Target development machine: Windows, Intel i7-12700H, 16 GB RAM, Intel Iris Xe, no CUDA.
- Use a repository-managed Python 3.11 runtime through `uv`; do not depend on the installed Python 3.13/3.14 runtimes.
- The GitHub Pages frontend remains static and connects only to a loopback companion service.
- Original files and rendered pages stay local. The service does not persist uploads or send them to cloud APIs.
- Cloud Providers remain explicit user-selected fallbacks. No automatic paid fallback is allowed.
- Model and dependency licenses must be recorded before an engine can ship.

## 3. Selected Architecture

Create a new `formula-ocr-engine` Python subsystem with a stable HTTP contract and pluggable engine adapters.

```text
React workbench
  -> LocalProvider (http://127.0.0.1:8502)
      -> FastAPI contract and bounded job queue
          -> PaddleFormulaEngine (PP-FormulaNet)
          -> Pix2TextDetectionEngine (MFD 1.5)
          -> Pix2TextDocumentEngine (PDF/image -> Markdown)
```

The service owns model loading, CPU concurrency, cancellation, temporary memory, and license metadata. The frontend owns user intent, file/task state, display, selection, editing, and exports.

### Why this architecture

- PaddleOCR is Apache 2.0 and exposes dedicated formula recognition models instead of a general vision chat model.
- Pix2Text is MIT and provides formula detection, formula recognition, layout analysis, and PDF-to-Markdown support.
- A local HTTP boundary keeps Python/ML dependencies out of the Vite build and allows independent upgrades.
- Engine adapters allow benchmark-driven selection and later replacement without changing the frontend contract.

MinerU is deferred. Its document capabilities are strong, but it introduces a heavier runtime and an attribution/custom-commercial-license obligation. Mathpix, SimpleTex, and GLM-OCR remain optional cloud integrations because they are not zero-cost self-hosted engines.

## 4. Repository Layout

```text
formula-ocr-engine/
  pyproject.toml
  uv.lock
  README.md
  THIRD_PARTY_NOTICES.md
  scripts/
    setup.ps1
    start.ps1
    doctor.ps1
  src/formula_ocr_engine/
    app.py
    config.py
    contracts.py
    errors.py
    queue.py
    model_manager.py
    engines/
      base.py
      paddle_formula.py
      pix2text_detection.py
      pix2text_document.py
    services/
      recognition.py
      detection.py
      documents.py
      jobs.py
  tests/
    unit/
    contract/
    integration/
```

Each module has one responsibility. Model-specific imports remain inside engine adapters so the health endpoint and contract tests can run without loading model weights.

## 5. HTTP Contract

All responses include `requestId`, `status`, `engine`, and `processingTime` where applicable. Error responses use stable `errorClass` values shared with the frontend.

### `GET /health`

Returns immediately without loading models.

```json
{
  "status": "ok",
  "version": "1.0.0",
  "device": "cpu",
  "models": {
    "formula": "not_loaded",
    "detection": "not_loaded",
    "document": "not_loaded"
  }
}
```

### `GET /v1/capabilities`

Returns installed engines, supported MIME types, file limits, model versions, license identifiers, and whether document parsing is available.

### `POST /v1/recognize`

Input follows the frontend recognition contract:

```json
{
  "requestId": "...",
  "image": "base64 or data URL",
  "mime": "image/png",
  "formulaType": "auto",
  "mode": "single",
  "source": { "kind": "pdf", "pageNumber": 3, "regionId": "..." }
}
```

Output:

```json
{
  "requestId": "...",
  "success": true,
  "status": "success",
  "latex": "E=mc^2",
  "formulas": [{ "latex": "E=mc^2", "uncertainties": [] }],
  "formulaCount": 1,
  "uncertainties": [],
  "confidence": 0.93,
  "engine": "paddle-pp-formulanet-s",
  "processingTime": 312
}
```

### `POST /v1/detect`

Accepts one rendered page image and returns formula boxes in source-pixel coordinates. Every box includes confidence, formula type, and detector version. Detection does not perform OCR.

### `POST /v1/jobs/documents`

Accepts PDF bytes through multipart upload, validates MIME/size/page limits, creates a cancellable job, and returns `202` with a job ID. The service processes pages incrementally and never keeps every high-resolution page decoded at once.

### `GET /v1/jobs/{jobId}`

Returns queued/running/completed/failed/cancelled state, page progress, warnings, Markdown result, and formula metadata when completed.

### `DELETE /v1/jobs/{jobId}`

Requests cancellation. The active page may finish, but no later page starts and no completed result is published after cancellation.

## 6. Model Lifecycle and Performance

- Health checks never load model weights.
- Each model loads lazily on first use and exposes `loading`, `ready`, and `failed` states.
- CPU formula concurrency defaults to one. Requests queue with a bounded maximum; excess requests receive `queue_full`.
- The service records only metadata timings in memory. It does not log base64, images, PDFs, recognized content, or API keys.
- Images have decoded pixel and byte limits. PDFs retain the existing 50 MB / 100-page limits.
- Temporary PDF files use an OS temporary directory and are deleted in `finally` blocks.
- Graceful shutdown cancels pending jobs and releases adapters.
- Model download location is configurable and excluded from Git.

PP-FormulaNet-S is the initial CPU candidate. Larger PP-FormulaNet or Pix2Text MFR variants are optional benchmark candidates, not default dependencies. The final default is selected by measured accuracy, latency, memory, and license availability.

## 7. Frontend Integration

- Replace the misleading Ollama/pix2tex local setup text with the actual companion-service workflow.
- Extend local server health to consume `/health` and `/v1/capabilities`.
- Send the full recognition request contract instead of `{image}` only.
- Preserve `AbortSignal`; cancellation must abort the browser request and call the document job cancellation endpoint.
- Display model loading, unavailable, queue full, unsupported format, cancelled, needs review, and success separately.
- Do not mark the local engine as recommended until benchmark gates pass.
- Do not automatically fall back to a cloud Provider.

## 8. Error Classes

Stable error classes:

- `invalid_input`
- `unsupported_format`
- `file_too_large`
- `page_limit`
- `model_unavailable`
- `model_loading_failed`
- `queue_full`
- `timeout`
- `cancelled`
- `detection_failed`
- `invalid_output`
- `internal`

Raw exception text is logged only in local development and is not returned when it may expose paths or implementation details.

## 9. Security and Privacy

- Bind to `127.0.0.1`, not all interfaces, by default.
- Restrict CORS to configured local frontend origins.
- Reject remote URLs; endpoints accept local upload bytes or base64 only, preventing SSRF.
- Validate magic bytes and decoded dimensions rather than trusting the MIME header.
- Apply request byte limits before base64 decode where possible.
- Never persist user documents, OCR results, or document history.
- No telemetry by default.
- Setup scripts do not request administrator privileges or modify global Python packages.

## 10. Licensing and Commercial Compliance

- Add `formula-ocr-engine/THIRD_PARTY_NOTICES.md` with exact package/model versions, source URLs, code licenses, weight licenses, copyright notices, and required attributions.
- Include Apache 2.0 and MIT license texts in distributable packages.
- Record SHA-256 for downloaded model artifacts when the upstream source provides stable files.
- An adapter is disabled if its model-weight license cannot be verified for the intended commercial use.
- Do not use upstream names or logos to imply endorsement.
- MinerU remains disabled until its attribution/custom-license requirements are deliberately accepted.

### Public benchmark data

The current public repository contains 33 small formula crops derived from papers. For the commercial-safe public package, replace those PNG files with synthetic renders generated from the human LaTeX ground truth. Keep the real paper PDFs, page images, and paper-derived crops in a private local benchmark directory. Do not rewrite Git history or force-push; remove the files from the current tree in a normal commit and document that previous revisions contained evaluation excerpts.

## 11. Testing Strategy

### Python tests

- Contract validation for every endpoint and error class.
- Queue concurrency, overflow, cancellation, and shutdown.
- Lazy model loading and failed-load recovery.
- MIME, base64, pixel, PDF size, and page-count limits.
- Temporary-file cleanup on success, failure, and cancellation.
- Fake engine adapters for deterministic unit tests.

### Frontend tests

- Local Provider sends the complete recognition contract.
- Health/capability state maps to distinct UI states.
- AbortSignal reaches the transport.
- No automatic cloud fallback.
- Document job polling terminates on completion, failure, and cancellation.

### Real model tests

- Mark model-backed tests as opt-in (`RUN_MODEL_TESTS=1`) so ordinary CI remains deterministic.
- Run the private 33-formula benchmark against every candidate formula engine.
- Run formula detection against the private page-box benchmark.
- Run representative text-layer, scanned, long, corrupted, and cancellation PDF fixtures.

## 12. Quality Gates

These are release gates, not current claims:

- Formula OCR product-valid rate: at least 30/33.
- Formula OCR human-acceptable rate: at least 24/33.
- Formula detection precision and recall: each at least 0.70 at IoU >= 0.5.
- Single-formula CPU P95: at most 5 seconds on the reference machine.
- Cancellation: no later job result after cancellation.
- Peak memory: no unbounded growth across the 85-page fixture.
- Frontend lint, TypeScript, all deterministic tests, production build, and moderate dependency audit pass.
- Python formatting, type checking, unit/contract tests, and dependency audit pass.

If an engine misses a gate, it remains opt-in and the actual metrics are published. No aggregate score may hide a failing detection, OCR, cancellation, memory, or privacy gate.

## 13. Delivery Phases

1. Service skeleton, contracts, queue, cancellation, tests, setup/doctor scripts.
2. PaddleOCR formula adapter and 33-formula benchmark.
3. Pix2Text formula detection and page-box benchmark.
4. Pix2Text PDF-to-Markdown jobs and long/corrupt PDF tests.
5. Frontend local Provider, job states, setup UX, and Playwright QA.
6. License notices, synthetic public fixtures, private benchmark routing, final regression, and GitHub update.

Each phase must produce a runnable, tested deliverable. Three consecutive unsuccessful fixes trigger an architecture review rather than further patching.
