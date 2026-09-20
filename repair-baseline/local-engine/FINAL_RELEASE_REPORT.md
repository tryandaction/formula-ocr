# Formula OCR Final Repair Report

Date: 2026-09-21
Reference machine: Windows, Intel i7-12700H, 16 GB RAM, Intel Iris Xe, no CUDA

## Delivered

- Unified image recognition contract across frontend/local service: request id, MIME, formula type, mode, source, LaTeX, formula list, uncertainties, confidence, engine/provider, timing, and stable error class.
- Python 3.11/uv local companion service with loopback-only default, explicit CORS origins, remote-URL rejection, MIME/magic/pixel/byte validation, lazy models, bounded work, cancellation, and no document/content logging.
- Real PP-FormulaNet-S CPU adapter, MFD 1.5 ONNX detection adapter, versioned benchmark runners, and human review.
- Source-preserving Markdown parsing and DOCX OOXML/OMML/embedded-image parsing; unsupported OLE objects remain explicit warnings.
- PDF browser path retains text-layer extraction, bounded page rendering, manual selection, page/source metadata, cancellation, and failure isolation.
- Cancellable multipart PDF job protocol with capacity, progress, terminal states, no late completed result after cancellation, and temporary-file cleanup.
- Workbench states and actionable messages for no formula, invalid output, network/auth/quota/rate limit, model unavailable/load failure, queue full, cancelled, needs review, and success.
- Desktop/mobile Playwright QA, 20-row initial result bound, editable results, export, and queue rejection UX.
- Setup/start/doctor scripts, third-party notices, synthetic public fixtures, and private real-paper benchmark routing.

## Measured Quality

| Surface | Current measured result | Gate | Decision |
|---|---|---|---|
| PP-FormulaNet-S product-valid | 15/33 | at least 30/33 | fail; experimental |
| PP-FormulaNet-S human acceptable | 10/33 (30.30%) | at least 24/33 | fail; experimental |
| PP-FormulaNet-S exact/normalized | 0/33 / 0/33 | reported independently | not used as release success |
| PP-FormulaNet-S CPU latency | P50 1235ms, P95 5340ms | P95 at most 5000ms | fail |
| MFD 1.5 display detection | precision 25.00%, recall 27.27%, IoU 0.6322 | precision/recall each at least 70% | fail; automatic path disabled |
| Historical GLM pairing | human acceptable 2/33 (6.06%) | not a release engine | retained as baseline only |

All percentages apply only to the recorded 33-formula/ten-page benchmark and named runtime. They are not general accuracy claims.

## Disabled or Unsupported

- Automatic MFD PDF detection is not enabled because measured precision/recall failed.
- Full local Pix2Text PDF-to-Markdown is disabled. The working dependency line had known audit findings; the audited Transformers 5.x line was incompatible with Pix2Text's resolved Optimum API.
- Legacy DOCX OLE/Equation Editor objects are warnings, not converted results.
- No cloud Provider is selected automatically after a local error.

## Privacy and Commercial Review

- Public paper-derived PNG crops were removed in a normal commit without rewriting history.
- Public distributable fixtures are 33 project-generated KaTeX PNG files with SHA-256 manifest.
- Real source PDFs/pages/crops belong in the gitignored `private-real-pdf-v1` directory.
- PP-FormulaNet-S code/weights are recorded as Apache-2.0; MFD 1.5 weights as MIT; exact versions and source links are in `formula-ocr-engine/THIRD_PARTY_NOTICES.md`.
- The service binds `127.0.0.1`, rejects remote input URLs, and does not persist uploads/results or enable telemetry.

## Deployment and Operation

Frontend deployment remains static GitHub Pages. The user runs the companion service locally:

```powershell
cd "formula-ocr-engine"
./scripts/setup.ps1
./scripts/doctor.ps1
./scripts/start.ps1
```

Optional detection dependencies use `./scripts/setup.ps1 -WithDetection`. GitHub Actions billing lock, if still present, prevents a new workflow run; pushing code does not prove Pages redeployed.

## Rollback

- Each phase is an independent Git commit and can be reverted normally without history rewriting.
- The local Provider remains optional; selecting a cloud Provider or using Markdown/DOCX/PDF source/manual paths does not require the companion service.
- Removed public crops remain recoverable from Git history, but redistributing them again requires a deliberate copyright review.

## Residual Priorities

1. Evaluate a stronger commercially cleared formula recognizer against the same private benchmark.
2. Improve or replace display detection before automatic PDF candidate extraction.
3. Revisit PDF-to-Markdown only after a compatible audited dependency stack is available.
4. Expand human ground truth to scans, handwriting, chemistry, more publishers, and more languages without changing prior results.
