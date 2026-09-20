# Local OCR Architecture Gaps

Date: 2026-09-20

## Confirmed Existing Capabilities

- The React workbench passes `formulaType`, mode, MIME, request id, and source metadata through `RecognitionRequest`.
- Provider responses have conservative JSON/LaTeX parsing, KaTeX validation, uncertainty state, timeout, and cancellation support.
- PDF browser processing separates text-layer candidates, visual detection candidates, and manual selection.
- DOCX handles common OMML plus embedded images; Markdown preserves source formulas and skips code blocks.
- Queue/runtime tests, frontend lint, tests, build, Worker typecheck, and official-registry high-level audits currently pass.
- A versioned 33-formula ground truth and page-box evaluator exist, but the paper-derived public crops require replacement before a commercial-safe public release.

## Confirmed Missing or Misleading Boundaries

| Boundary | Evidence | Required change |
|---|---|---|
| Local service | No `formula-ocr-engine` or runnable server exists. | Add a Python 3.11 uv-managed companion service with deterministic contract tests. |
| Local request | `local.ts` posts only `{image}` to `/recognize`. | Send the full `/v1/recognize` request and preserve structured results. |
| Local setup copy | Code comments say Pix2Tex while UI instructions install Ollama/llama3.2-vision. | Replace with the actual companion-service setup and capability states. |
| Dedicated formula model | Current measured GLM path has 0/33 exact/normalized and 2/33 acceptable for the replayed input pairing. | Add PaddleOCR PP-FormulaNet behind an adapter and measure it on unchanged ground truth. |
| Formula detection | Existing raster detector has 6.74% precision and 18.18% recall. | Add Pix2Text MFD behind a separate endpoint; keep it opt-in unless both gates pass. |
| PDF document OCR | Browser flow renders/detects regions; no local PDF-to-Markdown model job exists. | Add bounded, cancellable, page-incremental document jobs. |
| Model lifecycle | No lazy model state, bounded server queue, or model load failure recovery exists. | Add model manager and explicit `not_loaded/loading/ready/failed` states. |
| License evidence | Code-license summaries exist only in design discussion; exact installed packages and weight terms are not recorded. | Lock versions and write `THIRD_PARTY_NOTICES.md` before enabling an adapter. |
| Public benchmark data | Current public crops are paper-derived excerpts. | Generate synthetic public crops and route real-paper evaluation to a private ignored directory without history rewriting. |
| Published metric consistency | Current evaluator pairing yields 2/33 acceptable while public docs say 3/33. | Publish metrics with exact result/review filenames and reconcile docs in Phase 8. |

## Phase Boundaries

1. Phase 1 establishes the service contract, safe image boundary, dedicated formula adapter, and real OCR benchmark.
2. Phase 2 compares preprocessing variants and keeps the original image unless measured evidence selects another variant.
3. Phase 3 replaces the false local frontend contract and setup copy.
4. Phase 4 adds formula detection and PDF document jobs with separate metrics.
5. Phase 5 revalidates existing DOCX/Markdown source paths with real fixtures.
6. Phase 6 proves queue, cache, timeout, and cancellation behavior.
7. Phase 7 exposes distinct states and browser end-to-end flows.
8. Phase 8 completes license evidence, synthetic public fixtures, regression, documentation, and GitHub delivery.

No aggregate score may conceal a failed OCR, detection, cancellation, memory, license, or privacy boundary.
