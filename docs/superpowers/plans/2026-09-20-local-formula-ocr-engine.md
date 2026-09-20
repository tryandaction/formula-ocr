# Local Formula OCR Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate a commercially usable, zero-per-request-cost local formula/document OCR service, then prove its real behavior against versioned OCR, detection, document, cancellation, and UI gates.

**Architecture:** A Python 3.11 FastAPI companion service owns model loading, bounded CPU work, formula recognition, formula detection, PDF document jobs, cancellation, and temporary files. The existing React workbench remains the source of user intent and consumes one stable local HTTP contract; PaddleOCR PP-FormulaNet is the first formula recognizer, while Pix2Text supplies formula detection and PDF-to-Markdown capabilities behind replaceable adapters.

**Tech Stack:** Python 3.11, uv, FastAPI, Pydantic v2, Pillow, PaddleOCR/PP-FormulaNet, Pix2Text MFD/MFR 1.5, pytest, Ruff, mypy, React 19, TypeScript 5.9, Vitest, Playwright, Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-09-20-local-ocr-engine-design.md`

## Global Constraints

- Target machine: Windows, Intel i7-12700H, 16 GB RAM, Intel Iris Xe, no CUDA.
- Use a repository-managed Python 3.11 runtime through `uv`; do not use the installed Python 3.13/3.14 runtimes.
- Bind the companion service to `127.0.0.1:8502` by default and reject remote URLs.
- Keep original files and rendered pages local; do not persist uploads or send them to cloud APIs.
- Cloud Providers remain explicit user-selected fallbacks; never switch to a paid Provider automatically.
- Preserve existing uncommitted/user files, especially `formula-ocr/src/utils/advancedFormulaDetection/interfaces.ts` and `formula-ocr/src/utils/wholePageRecognition/types.ts`.
- Maintain the phase order in `REPAIR_PLAN`: Phase 0, 1, 2, 3, 4, 5, 6, 7, then 8.
- Every behavior change follows red-green-refactor: write one focused failing test, run it and verify the intended failure, implement the minimum, then rerun targeted and regression tests.
- Separate formula detection metrics from OCR metrics; mock/contract tests never count as recognition accuracy.
- Disable any model adapter whose code or model-weight commercial-use terms cannot be verified.
- Three consecutive fixes that only move the symptom trigger an architecture review before another patch.
- Do not claim a release gate passed without a recorded command and measured output from the current checkout.

## Authoritative References

- PaddleOCR formula recognition API: `https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/module_usage/formula_recognition.html`
- Pix2Text repository and supported MFD/MFR/PDF paths: `https://github.com/breezedeus/Pix2Text`
- Pix2Text usage API: `https://github.com/breezedeus/Pix2Text/blob/main/docs/usage.md`
- uv managed Python/project workflow: `https://docs.astral.sh/uv/concepts/projects/`
- FastAPI upload boundary: `https://fastapi.tiangolo.com/tutorial/request-files/`

---

### Task 1: Phase 0 Fresh Baseline and Protected-Tree Inventory

**Files:**
- Create: `repair-baseline/local-engine/PHASE0_BASELINE_2026-09-20.md`
- Create: `repair-baseline/local-engine/ARCHITECTURE_GAPS.md`
- Read only: `formula-ocr/src/utils/advancedFormulaDetection/interfaces.ts`
- Read only: `formula-ocr/src/utils/wholePageRecognition/types.ts`

**Interfaces:**
- Consumes: current Git worktree, existing Phase 0–8 reports, current frontend/Worker commands.
- Produces: immutable command evidence and the exact gap list used by all later tasks.

- [ ] **Step 1: Capture protected worktree evidence before any implementation edit**

```powershell
git status --short
git diff -- "formula-ocr/src/utils/advancedFormulaDetection/interfaces.ts" "formula-ocr/src/utils/wholePageRecognition/types.ts"
git rev-parse HEAD
```

Record the complete output and exit codes in `PHASE0_BASELINE_2026-09-20.md`. Stop if either protected file has an uncommitted diff that a later task would need to edit.

- [ ] **Step 2: Run the current quality baseline**

```powershell
cd "formula-ocr"
npm run lint
npm run test:run
npm run build
npm audit --omit=dev --audit-level=high

cd "../formula-ocr-worker"
npx tsc --noEmit
npm audit --omit=dev --audit-level=high
```

Expected: record actual exits, test counts, lint counts, audit findings, and elapsed times. Any failure becomes an explicit open issue; do not edit code in this step.

- [ ] **Step 3: Run the existing benchmark evaluators without changing ground truth**

```powershell
node --test "repair-baseline/evaluate-real-pdf.test.mjs"
node "repair-baseline/evaluate-real-pdf.mjs" `
  "repair-baseline/fixtures/real-pdf-v1/manifest.json" `
  "repair-baseline/fixtures/real-pdf-v1/detection-results.json" `
  "repair-baseline/fixtures/real-pdf-v1/ocr-product-results-json-mode-v2.json" `
  "repair-baseline/fixtures/real-pdf-v1/human-review-json-mode.json"
```

Expected: evaluator tests pass; measured baseline remains explicitly split into detection and OCR output.

- [ ] **Step 4: Document the single Phase 0 root-cause hypothesis and stop condition**

```markdown
Single hypothesis: the current frontend contract is structurally sound, but the `local` provider has no real companion service and violates that contract by sending only `{image}`; therefore no dedicated local OCR capability can be measured or used.

Stop condition: current command evidence, protected-file status, existing contract boundaries, and missing-service boundary are all reproducible from the report.
```

- [ ] **Step 5: Commit only the two Phase 0 evidence files**

```powershell
git add -- "repair-baseline/local-engine/PHASE0_BASELINE_2026-09-20.md" "repair-baseline/local-engine/ARCHITECTURE_GAPS.md"
git diff --cached --check
git commit -m "docs: record local OCR engine baseline"
```

### Task 2: Phase 1 Service Contract and Fast Health Path

**Files:**
- Create: `formula-ocr-engine/.python-version`
- Create: `formula-ocr-engine/pyproject.toml`
- Create: `formula-ocr-engine/uv.lock`
- Create: `formula-ocr-engine/src/formula_ocr_engine/__init__.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/app.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/config.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/contracts.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/errors.py`
- Create: `formula-ocr-engine/tests/conftest.py`
- Create: `formula-ocr-engine/tests/contract/test_health.py`
- Create: `formula-ocr-engine/tests/contract/test_recognition_contract.py`

**Interfaces:**
- Consumes: frontend `RecognitionRequest` fields from `formula-ocr/src/utils/ocrContract.ts`.
- Produces: `create_app(settings: Settings) -> FastAPI`, `RecognitionRequest`, `RecognitionResponse`, `ErrorResponse`, `/health`, `/v1/capabilities`, `/v1/recognize`.

- [ ] **Step 1: Create the Python 3.11 project and deterministic core dependency set**

```toml
[project]
name = "formula-ocr-engine"
version = "0.1.0"
requires-python = ">=3.11,<3.12"
dependencies = [
  "fastapi>=0.115,<1",
  "pydantic>=2.10,<3",
  "pillow>=11,<12",
  "python-multipart>=0.0.20,<1",
  "uvicorn[standard]>=0.34,<1",
]

[project.optional-dependencies]
paddle = ["paddleocr>=3,<4", "paddlepaddle>=3,<4"]
pix2text = ["pix2text>=1.1.4,<2"]
dev = ["httpx>=0.28,<1", "mypy>=1.15,<2", "pip-audit>=2.9,<3", "pytest>=8,<9", "pytest-asyncio>=0.25,<1", "ruff>=0.11,<1"]

[project.scripts]
formula-ocr-engine = "formula_ocr_engine.app:main"
```

Run `uv lock --python 3.11`; if Paddle/Pix2Text cannot resolve together, stop and record the exact resolver conflict before deciding whether model adapters need isolated environments.

- [ ] **Step 2: Write failing health and capability contract tests**

```python
def test_health_does_not_load_models(client, fake_model_manager):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["models"] == {
        "formula": "not_loaded",
        "detection": "not_loaded",
        "document": "not_loaded",
    }
    fake_model_manager.assert_not_loaded()

def test_capabilities_reports_mime_limits_and_licenses(client):
    body = client.get("/v1/capabilities").json()
    assert body["supportedMimeTypes"] == ["image/png", "image/jpeg", "image/webp", "application/pdf"]
    assert body["limits"]["pdfPages"] == 100
    assert all("license" in engine for engine in body["engines"])
```

- [ ] **Step 3: Run tests and verify the expected import/route failure**

```powershell
cd "formula-ocr-engine"
uv run --python 3.11 pytest "tests/contract/test_health.py" -q
```

Expected: fail because `formula_ocr_engine.app` or the routes do not exist.

- [ ] **Step 4: Implement exact shared enums and response fields**

```python
class RecognitionStatus(StrEnum):
    SUCCESS = "success"
    NEEDS_REVIEW = "needs_review"
    NO_FORMULA = "no_formula"
    FAILED = "failed"
    CANCELLED = "cancelled"

class RecognitionResponse(BaseModel):
    requestId: str
    success: bool
    status: RecognitionStatus
    latex: str
    formulas: list[FormulaResult]
    formulaCount: int
    uncertainties: list[str]
    confidence: float | None = None
    engine: str
    provider: Literal["local"] = "local"
    processingTime: int
    errorClass: ErrorClass | None = None
    error: str | None = None
```

Define `ErrorClass` with exactly `invalid_input`, `unsupported_format`, `file_too_large`, `page_limit`, `model_unavailable`, `model_loading_failed`, `queue_full`, `timeout`, `cancelled`, `detection_failed`, `invalid_output`, and `internal`. `tests/conftest.py` supplies `Settings`, an injected fake model manager, and `TestClient` without importing model packages.

Keep `/health` synchronous and model-free. Return `503 model_unavailable` from `/v1/recognize` until Task 4 installs a formula engine. Add CORS middleware from the explicit `FORMULA_OCR_ALLOWED_ORIGINS` list; reject wildcard origins. `main()` must bind `127.0.0.1:8502` unless an explicit local configuration overrides the port.

- [ ] **Step 5: Verify contract, formatting, typing, and core dependency audit**

```powershell
uv run pytest "tests/contract" -q
uv run ruff check .
uv run mypy "src/formula_ocr_engine"
uv run pip-audit
```

- [ ] **Step 6: Commit the independently runnable service contract**

```powershell
git add -- "formula-ocr-engine"
git diff --cached --check
git commit -m "feat: add local OCR service contract"
```

### Task 3: Phase 1 Input Validation Boundary

**Files:**
- Create: `formula-ocr-engine/src/formula_ocr_engine/image_input.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/preprocessing.py`
- Create: `formula-ocr-engine/tests/unit/test_image_input.py`
- Create: `formula-ocr-engine/tests/unit/test_preprocessing.py`
- Modify: `formula-ocr-engine/src/formula_ocr_engine/contracts.py`

**Interfaces:**
- Consumes: `RecognitionRequest.image`, declared MIME, 16 MB encoded-body limit.
- Produces: `decode_image(request) -> DecodedImage`, `prepare_variants(decoded, policy) -> list[PreparedImage]` with source dimensions, output dimensions, scale, padding, variant, and elapsed milliseconds.

- [ ] **Step 1: Write failing validation tests for spoofed MIME, decompression bombs, blank and rotated images**

```python
@pytest.mark.parametrize("declared", ["image/png", "image/jpeg"])
def test_magic_bytes_must_match_declared_mime(declared, image_factory):
    request = recognition_request(image_factory.webp_data_url(), mime=declared)
    with pytest.raises(EngineError, match="unsupported_format"):
        decode_image(request)

def test_decoded_pixel_limit_is_enforced(image_factory):
    request = recognition_request(image_factory.png_header(width=20000, height=20000))
    with pytest.raises(EngineError, match="file_too_large"):
        decode_image(request)
```

- [ ] **Step 2: Run focused tests and verify missing decoder failures**

```powershell
uv run pytest "tests/unit/test_image_input.py" "tests/unit/test_preprocessing.py" -q
```

- [ ] **Step 3: Implement one validated source image and explicit variants**

```python
@dataclass(frozen=True)
class PreparedImage:
    image: Image.Image
    variant: Literal["original", "upscale", "grayscale", "binary"]
    source_size: tuple[int, int]
    output_size: tuple[int, int]
    scale: float
    padding: tuple[int, int, int, int]
    processing_ms: int
```

Apply EXIF transpose, composite transparency onto white, and convert to RGB. Reject `http://` and `https://` values before decoding. Keep `original` as the default until Task 5 supplies measured evidence for another policy.

- [ ] **Step 4: Add regression assertions for thin fraction bars, subscripts, superscripts, and Greek glyphs**

```python
def test_original_variant_preserves_source_pixels(thin_formula_png):
    decoded = decode_image(recognition_request(thin_formula_png))
    prepared = prepare_variants(decoded, policy="original")[0]
    assert prepared.image.tobytes() == decoded.image.tobytes()
    assert prepared.scale == 1
    assert prepared.padding == (0, 0, 0, 0)
```

- [ ] **Step 5: Verify and commit**

```powershell
uv run pytest "tests/unit/test_image_input.py" "tests/unit/test_preprocessing.py" -q
uv run ruff check .
uv run mypy "src/formula_ocr_engine"
git add -- "formula-ocr-engine/src/formula_ocr_engine/image_input.py" "formula-ocr-engine/src/formula_ocr_engine/preprocessing.py" "formula-ocr-engine/src/formula_ocr_engine/contracts.py" "formula-ocr-engine/tests/unit"
git commit -m "feat: validate and prepare local OCR images"
```

### Task 4: Phase 1 Lazy Model Manager and Paddle Formula Adapter

**Files:**
- Create: `formula-ocr-engine/src/formula_ocr_engine/engines/base.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/engines/paddle_formula.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/model_manager.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/services/recognition.py`
- Create: `formula-ocr-engine/tests/unit/test_model_manager.py`
- Create: `formula-ocr-engine/tests/unit/test_paddle_formula.py`
- Create: `formula-ocr-engine/tests/integration/test_recognition_api.py`
- Modify: `formula-ocr-engine/src/formula_ocr_engine/app.py`

**Interfaces:**
- Consumes: `PreparedImage`, `formulaType`, `mode`, optional injected fake model.
- Produces: `FormulaEngine.recognize(image, formula_type, mode) -> EngineRecognition`; adapter id `paddle-pp-formulanet-s`; lazy states `not_loaded/loading/ready/failed`.

- [ ] **Step 1: Write failing lazy-load and output-adaptation tests**

```python
def test_concurrent_first_requests_load_formula_model_once():
    factory = CountingFormulaFactory(result="E=mc^2")
    manager = ModelManager(formula_factory=factory)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: manager.formula().recognize(sample_image(), "physics", "single"), range(4)))
    assert factory.calls == 1
    assert [result.latex for result in results] == ["E=mc^2"] * 4

def test_paddle_adapter_rejects_missing_rec_formula(fake_paddle_result):
    fake_paddle_result.json = {"res": {}}
    with pytest.raises(EngineError, match="invalid_output"):
        PaddleFormulaEngine(model=FakePaddleModel(fake_paddle_result)).recognize(sample_image(), "auto", "single")
```

- [ ] **Step 2: Run tests and confirm missing manager/adapter failures**

```powershell
uv run pytest "tests/unit/test_model_manager.py" "tests/unit/test_paddle_formula.py" -q
```

- [ ] **Step 3: Implement the adapter with model imports inside the factory only**

```python
def _build_model():
    from paddleocr import FormulaRecognition
    return FormulaRecognition(model_name="PP-FormulaNet-S")

class PaddleFormulaEngine:
    engine_id = "paddle-pp-formulanet-s"
    def recognize(self, image: Image.Image, formula_type: str, mode: str) -> EngineRecognition:
        prediction = next(iter(self._model.predict(input=np.asarray(image), batch_size=1)))
        latex = extract_rec_formula(prediction)
        return EngineRecognition(latex=latex, formulas=[latex], uncertainties=[])
```

The extraction function must handle only documented/observed Paddle result shapes and fail closed on unknown shapes. Do not use model confidence as ground-truth accuracy.

- [ ] **Step 4: Make `/v1/recognize` return the full stable contract**

```python
result = recognition_service.recognize(request)
assert response.model_dump()["requestId"] == request.requestId
assert response.formulaCount == len(response.formulas)
assert response.engine == "paddle-pp-formulanet-s"
```

Map import/download/init failures to `model_unavailable` or `model_loading_failed`; map invalid model output to `invalid_output`.

- [ ] **Step 5: Verify deterministic tests without model weights**

```powershell
uv run pytest "tests/unit" "tests/contract" "tests/integration/test_recognition_api.py" -q
uv run ruff check .
uv run mypy "src/formula_ocr_engine"
```

- [ ] **Step 6: Run one opt-in real-model smoke test and record facts**

```powershell
$env:RUN_MODEL_TESTS="1"
uv run --extra paddle pytest "tests/integration/test_recognition_api.py" -m model -v
Remove-Item Env:RUN_MODEL_TESTS
```

Expected: either a measured result with model/version/download size/startup time, or an exact recorded blocker. A blocked download or unsupported CPU wheel does not become a passing claim.

- [ ] **Step 7: Commit adapter and measured smoke evidence**

```powershell
git add -- "formula-ocr-engine" "repair-baseline/local-engine"
git diff --cached --check
git commit -m "feat: add Paddle formula recognition adapter"
```

### Task 5: Complete Phase 1 Benchmark, Then Enter Phase 2 Variant Comparison

**Files:**
- Create: `formula-ocr-engine/scripts/run_formula_benchmark.py`
- Create: `formula-ocr-engine/tests/unit/test_formula_benchmark.py`
- Create: `repair-baseline/local-engine/README.md`
- Create after execution: `repair-baseline/local-engine/paddle-pp-formulanet-s-results.json`
- Create after human review: `repair-baseline/local-engine/paddle-pp-formulanet-s-human-review.json`
- Modify: `repair-baseline/evaluate-real-pdf.mjs` only if a failing compatibility test proves a schema gap.

**Interfaces:**
- Consumes: private/local 33-crop manifest, immutable human LaTeX, service `/v1/recognize`.
- Produces: per-sample result JSON with request id, engine, variant, latex, status, errors, timings; evaluator-compatible metrics.

- [ ] **Step 1: Write a failing benchmark serialization test**

```python
def test_benchmark_keeps_failures_and_variant_metadata(tmp_path, fake_client):
    report = run_benchmark(manifest_with_two_samples(), fake_client, variants=["original"])
    assert [item["id"] for item in report["results"]] == ["a", "b"]
    assert report["results"][1]["status"] == "failed"
    assert report["results"][0]["variant"] == "original"
    assert "groundTruthLatex" not in report["results"][0]
```

- [ ] **Step 2: Run the test and verify the missing runner failure**

```powershell
uv run pytest "tests/unit/test_formula_benchmark.py" -q
```

- [ ] **Step 3: Implement streaming benchmark execution and immutable output**

```python
for sample in manifest.samples:
    response = client.recognize(sample.crop, sample.formula_type, variant)
    writer.append({
        "id": sample.id,
        "variant": variant,
        "latex": response.latex,
        "status": response.status,
        "errorClass": response.error_class,
        "processingTime": response.processing_time,
    })
```

Write to a new timestamped temporary file and atomically rename on completion; never overwrite old Provider/model results.

- [ ] **Step 4: Compare original/upscale/grayscale/binary without changing defaults**

```powershell
uv run python "scripts/run_formula_benchmark.py" --manifest "../repair-baseline/fixtures/real-pdf-v1/manifest.json" --variants original,upscale,grayscale,binary --output "../repair-baseline/local-engine/paddle-pp-formulanet-s-results.json"
node "../repair-baseline/evaluate-real-pdf.mjs" "../repair-baseline/fixtures/real-pdf-v1/manifest.json" "../repair-baseline/fixtures/real-pdf-v1/detection-results.json" "../repair-baseline/local-engine/paddle-pp-formulanet-s-results.json" "../repair-baseline/local-engine/paddle-pp-formulanet-s-human-review.json"
```

Expected: report exact, normalized, product-valid, human-acceptable, error classes, P50, and P95 per variant. Human-acceptable remains “unreviewed” until a human review file exists.

- [ ] **Step 5: Select a default only if a variant wins on measured OCR gates**

```python
def select_default_variant(metrics: dict[str, VariantMetrics]) -> str:
    qualified = [item for item in metrics.values() if item.sample_count >= 30]
    if not qualified:
        return "original"
    return max(qualified, key=lambda item: (item.human_acceptable_count, item.normalized_count, -item.p95_ms)).name
```

If no derived variant improves human-acceptable/normalized results without unacceptable latency, keep `original`.

- [ ] **Step 6: Commit benchmark code and measured output separately from ground truth**

```powershell
git add -- "formula-ocr-engine/scripts/run_formula_benchmark.py" "formula-ocr-engine/tests/unit/test_formula_benchmark.py" "repair-baseline/local-engine"
git commit -m "test: benchmark local formula recognition"
```

### Task 6: Phase 3 Frontend Local Provider Contract and Capabilities

**Files:**
- Modify: `formula-ocr/src/utils/providers/types.ts`
- Modify: `formula-ocr/src/utils/providers/contract.ts`
- Modify: `formula-ocr/src/utils/providers/local.ts`
- Modify: `formula-ocr/src/utils/providers/index.ts`
- Create: `formula-ocr/src/test/unit/localProvider.test.ts`
- Modify: `formula-ocr/src/test/unit/providerAdapter.test.ts`
- Modify: `formula-ocr/src/components/ProviderSelector.tsx`

**Interfaces:**
- Consumes: `/health`, `/v1/capabilities`, `/v1/recognize`; frontend `RecognitionRequest`; `AbortSignal`.
- Produces: `LocalCapabilities`, `LocalServerStatus`, structured local results accepted directly by `createProviderAdapter`.

- [ ] **Step 1: Write failing tests that assert the full body and exact endpoint**

```typescript
it('sends the full recognition contract to /v1/recognize', async () => {
  await localProvider.recognize(request.image, undefined, { ...context, signal });
  expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8502/v1/recognize', expect.objectContaining({
    body: JSON.stringify(request),
    signal,
  }));
});

it('does not recognize when health is up but formula capability is unavailable', async () => {
  mockCapabilities({ formula: { available: false, reason: 'model_unavailable' } });
  await expect(checkLocalServer()).resolves.toMatchObject({ available: false, errorClass: 'model_unavailable' });
});
```

- [ ] **Step 2: Run tests and confirm failures caused by `/recognize` and `{image}`**

```powershell
cd "formula-ocr"
npm run test:run -- "src/test/unit/localProvider.test.ts" "src/test/unit/providerAdapter.test.ts"
```

- [ ] **Step 3: Extend the adapter boundary without forcing cloud Providers to change**

```typescript
export type ProviderRawResponse = string | StructuredRecognitionResult;

export interface ProviderInterface {
  type: ProviderType;
  recognize(imageBase64: string, apiKey?: string, context?: RecognitionRequestContext): Promise<ProviderRawResponse>;
}
```

`createProviderAdapter` must validate an object response with the same result validator used for parsed text. It must preserve `engine`, `provider`, `processingTime`, uncertainties, error classes, and request id.

- [ ] **Step 4: Replace the false Pix2Tex/Ollama copy with the actual uv service workflow**

```text
cd formula-ocr-engine
uv sync --python 3.11 --extra paddle --extra pix2text --extra dev
uv run formula-ocr-engine
```

Display “service reachable” separately from “formula model ready”, “detection unavailable”, and “document engine unavailable”. Do not label local as recommended until its release gates pass.

- [ ] **Step 5: Verify targeted and full frontend gates**

```powershell
npm run test:run -- "src/test/unit/localProvider.test.ts" "src/test/unit/providerAdapter.test.ts" "src/test/unit/providerContract.test.ts"
npm run lint
npm run test:run
npm run build
```

- [ ] **Step 6: Commit the local Provider integration**

```powershell
git add -- "formula-ocr/src/utils/providers" "formula-ocr/src/components/ProviderSelector.tsx" "formula-ocr/src/test/unit/localProvider.test.ts" "formula-ocr/src/test/unit/providerAdapter.test.ts"
git commit -m "feat: connect frontend to local OCR service"
```

### Task 7: Phase 4 Pix2Text Detection Adapter and Coordinate Contract

**Files:**
- Create: `formula-ocr-engine/src/formula_ocr_engine/engines/pix2text_detection.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/services/detection.py`
- Create: `formula-ocr-engine/tests/unit/test_pix2text_detection.py`
- Create: `formula-ocr-engine/tests/contract/test_detection_api.py`
- Create: `formula-ocr-engine/scripts/run_detection_benchmark.py`
- Create after execution: `repair-baseline/local-engine/pix2text-mfd-1.5-detection-results.json`
- Modify: `formula-ocr-engine/src/formula_ocr_engine/app.py`

**Interfaces:**
- Consumes: rendered page image in source-pixel coordinates.
- Produces: `DetectionRegion(id, x, y, width, height, confidence, formulaType, detectorVersion)`; no OCR text.

- [ ] **Step 1: Write failing coordinate and schema tests**

```python
def test_detection_boxes_remain_in_source_pixel_coordinates(fake_detector):
    fake_detector.returns([[100, 50, 300, 150, 0.91]])
    result = detect(sample_page(width=1200, height=1800))
    assert result.regions[0].model_dump() == {
        "id": "region-1", "x": 100, "y": 50,
        "width": 200, "height": 100, "confidence": 0.91,
        "formulaType": "unknown", "detectorVersion": "pix2text-mfd-1.5",
    }
```

- [ ] **Step 2: Run the tests and verify the missing adapter failure**

```powershell
uv run pytest "tests/unit/test_pix2text_detection.py" "tests/contract/test_detection_api.py" -q
```

- [ ] **Step 3: Implement lazy Pix2Text detection with clamped, non-empty boxes**

```python
def normalize_box(box: Sequence[float], source_width: int, source_height: int) -> DetectionRegion:
    x1, y1, x2, y2 = clamp_xyxy(box, source_width, source_height)
    if x2 <= x1 or y2 <= y1:
        raise EngineError(ErrorClass.INVALID_OUTPUT, "detector returned an empty box")
    return DetectionRegion(x=x1, y=y1, width=x2-x1, height=y2-y1, ...)
```

Reject normalized/unknown coordinate conventions unless the adapter explicitly converts them and proves a round trip in tests.

- [ ] **Step 4: Run the real page-box benchmark**

```powershell
$env:RUN_MODEL_TESTS="1"
uv run --extra pix2text python "scripts/run_detection_benchmark.py" --manifest "../repair-baseline/fixtures/real-pdf-v1/manifest.json" --output "../repair-baseline/local-engine/pix2text-mfd-1.5-detection-results.json"
node "../repair-baseline/evaluate-real-pdf.mjs" "../repair-baseline/fixtures/real-pdf-v1/manifest.json" "../repair-baseline/local-engine/pix2text-mfd-1.5-detection-results.json"
Remove-Item Env:RUN_MODEL_TESTS
```

Expected: report TP, FP, FN, precision, recall, and matched mean IoU at IoU 0.5. If precision or recall is below 0.70, keep automatic detection opt-in and retain manual selection.

- [ ] **Step 5: Verify and commit**

```powershell
uv run pytest "tests/unit" "tests/contract" -q
uv run ruff check .
uv run mypy "src/formula_ocr_engine"
git add -- "formula-ocr-engine" "repair-baseline/local-engine/pix2text-mfd-1.5-detection-results.json"
git commit -m "feat: add measurable local formula detection"
```

### Task 8: Phase 4 PDF-to-Markdown Job API

**Files:**
- Create: `formula-ocr-engine/src/formula_ocr_engine/engines/pix2text_document.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/services/documents.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/services/jobs.py`
- Create: `formula-ocr-engine/src/formula_ocr_engine/queue.py`
- Create: `formula-ocr-engine/tests/unit/test_document_jobs.py`
- Create: `formula-ocr-engine/tests/integration/test_document_api.py`
- Modify: `formula-ocr-engine/src/formula_ocr_engine/app.py`

**Interfaces:**
- Consumes: PDF multipart bytes, `requestId`, optional page selection.
- Produces: `POST /v1/jobs/documents -> 202 JobAccepted`, `GET /v1/jobs/{id} -> DocumentJob`, `DELETE /v1/jobs/{id} -> cancelled`; final Markdown plus page/formula metadata.

- [ ] **Step 1: Write failing tests for magic bytes, limits, progress, cancellation, and cleanup**

```python
def test_cancelled_document_never_publishes_a_late_result(client, blocking_document_engine):
    job_id = submit_pdf(client, valid_pdf_bytes()).json()["jobId"]
    blocking_document_engine.wait_until_page_started(1)
    assert client.delete(f"/v1/jobs/{job_id}").json()["status"] == "cancelled"
    blocking_document_engine.release_page(1)
    assert client.get(f"/v1/jobs/{job_id}").json()["status"] == "cancelled"

def test_temporary_pdf_is_removed_after_engine_failure(client, temp_dir, failing_document_engine):
    job_id = submit_pdf(client, valid_pdf_bytes()).json()["jobId"]
    wait_for_terminal(client, job_id)
    assert list(temp_dir.iterdir()) == []
```

- [ ] **Step 2: Run tests and verify missing job-service failures**

```powershell
uv run pytest "tests/unit/test_document_jobs.py" "tests/integration/test_document_api.py" -q
```

- [ ] **Step 3: Implement bounded jobs and monotonic state transitions**

```python
ALLOWED = {
    JobStatus.QUEUED: {JobStatus.RUNNING, JobStatus.CANCELLED},
    JobStatus.RUNNING: {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED},
    JobStatus.COMPLETED: set(), JobStatus.FAILED: set(), JobStatus.CANCELLED: set(),
}
```

Use CPU concurrency `1`, queue capacity `8`, 50 MB PDF limit, and 100-page limit. Return `queue_full`, `file_too_large`, or `page_limit` without starting a model job.

- [ ] **Step 4: Implement Pix2Text PDF recognition behind a cancellable page boundary**

```python
document = self._pix2text.recognize_pdf(pdf_path, page_numbers=[page_index], table_as_image=True)
page_markdown = render_document_markdown(document, output_dir)
progress.publish(page=page_index + 1, total=page_count)
cancel_token.raise_if_cancelled()
```

Process one page at a time so cancellation and memory bounds are enforceable. Store only job metadata/result in memory and expire completed jobs after 30 minutes.

- [ ] **Step 5: Exercise long/corrupt PDF fixtures without claiming OCR accuracy**

```powershell
uv run pytest "tests/integration/test_document_api.py" -m "not model" -q
$env:RUN_MODEL_TESTS="1"
uv run --extra pix2text pytest "tests/integration/test_document_api.py" -m model -v
Remove-Item Env:RUN_MODEL_TESTS
```

Record page count, completion/cancellation, P50/P95 page time, peak RSS, and error class. Do not convert these runtime measurements into formula accuracy.

- [ ] **Step 6: Verify and commit**

```powershell
uv run pytest -q
uv run ruff check .
uv run mypy "src/formula_ocr_engine"
git add -- "formula-ocr-engine" "repair-baseline/local-engine"
git commit -m "feat: add cancellable local PDF jobs"
```

### Task 9: Phase 5 Preserve Source-Level DOCX and Markdown Paths

**Files:**
- Modify only if a failing test proves a defect: `formula-ocr/src/utils/documentImport.ts`
- Modify only if a failing test proves a defect: `formula-ocr/src/utils/documentFormats.ts`
- Modify only if a failing test proves a defect: `formula-ocr/src/utils/documentParser.ts`
- Create: `formula-ocr/src/test/fixtures/documents/omml-and-image.docx`
- Create: `formula-ocr/src/test/fixtures/documents/ole-object.docx`
- Create: `formula-ocr/src/test/integration/documentFormats.integration.test.ts`
- Modify: `repair-baseline/PHASE5_DOCUMENTS.md`

**Interfaces:**
- Consumes: DOCX OOXML/OMML/images and Markdown source delimiters.
- Produces: `DocumentFormulaSource`; source LaTeX is never sent to visual OCR; embedded images remain eligible for the selected Provider.

- [ ] **Step 1: Write failing fixture-backed integration tests**

```typescript
it('keeps OMML as editable source and sends only embedded images to OCR', async () => {
  const result = await importDocument(loadFixture('omml-and-image.docx'));
  expect(result.formulas.filter(x => x.sourceType === 'omml')).toHaveLength(2);
  expect(result.images).toHaveLength(1);
  expect(recognizeStructured).not.toHaveBeenCalled();
});

it('keeps Markdown formulas and excludes code fences and escaped dollars', async () => {
  const result = await importDocument(loadFixture('formulas.md'));
  expect(result.formulas.map(x => x.raw)).toEqual(['$E=mc^2$', '$$\\int_0^1 x\\,dx$$']);
});
```

- [ ] **Step 2: Run tests and classify failures before editing parsers**

```powershell
cd "formula-ocr"
npm run test:run -- "src/test/integration/documentFormats.integration.test.ts"
```

If current code passes, add only the real fixtures/report and do not refactor working parsers.

- [ ] **Step 3: Apply the smallest parser fix for each proven fixture failure**

```typescript
type DocumentFormulaSource = {
  id: string;
  fileName: string;
  format: 'docx' | 'markdown';
  sourceType: 'omml' | 'embedded-image' | 'markdown-source' | 'unsupported';
  location: { paragraph?: number; node?: number; line?: number };
  raw?: string;
  image?: string;
  latex?: string;
  editable: boolean;
  status: 'ready' | 'needs_review' | 'unsupported' | 'failed';
  error?: string;
};
```

- [ ] **Step 4: Verify document and full frontend regression**

```powershell
npm run test:run -- "src/test/integration/documentFormats.integration.test.ts" "src/test/unit/documentImportRegression.test.ts" "src/test/unit/documentFormats.test.ts"
npm run lint
npm run test:run
npm run build
```

- [ ] **Step 5: Commit fixture-backed document truthfulness**

```powershell
git add -- "formula-ocr/src/test/fixtures/documents" "formula-ocr/src/test/integration/documentFormats.integration.test.ts" "repair-baseline/PHASE5_DOCUMENTS.md"
git add -- "formula-ocr/src/utils/documentImport.ts" "formula-ocr/src/utils/documentFormats.ts" "formula-ocr/src/utils/documentParser.ts"
git diff --cached --check
git commit -m "test: verify DOCX and Markdown source paths"
```

### Task 10: Phase 6 Runtime Queue, Timeout, Cache, and Cancellation

**Files:**
- Modify: `formula-ocr-engine/src/formula_ocr_engine/queue.py`
- Modify: `formula-ocr-engine/src/formula_ocr_engine/services/jobs.py`
- Create: `formula-ocr-engine/tests/unit/test_queue.py`
- Modify: `formula-ocr/src/utils/taskQueue.ts`
- Modify: `formula-ocr/src/utils/runtimeState.ts`
- Create: `formula-ocr/src/utils/localDocumentClient.ts`
- Create: `formula-ocr/src/test/unit/localDocumentClient.test.ts`
- Modify: `formula-ocr/src/test/unit/workspaceQueue.test.ts`
- Modify: `formula-ocr/src/test/unit/runtimeState.test.ts`

**Interfaces:**
- Consumes: stable request id, formula id, `AbortSignal`, local document job id.
- Produces: bounded formula/document work, deterministic result ordering, capped retry, cache key including engine/model/preprocessing version, cancellation with no late writes.

- [ ] **Step 1: Write failing Python queue overflow and cancellation tests**

```python
def test_queue_rejects_ninth_waiting_job(single_worker_queue):
    fill_running_and_waiting(single_worker_queue, total=9)
    with pytest.raises(EngineError, match="queue_full"):
        single_worker_queue.submit(job())

def test_cancelled_waiting_job_never_runs(single_worker_queue):
    handle = single_worker_queue.submit(job())
    handle.cancel()
    release_worker(single_worker_queue)
    assert handle.status == "cancelled"
    assert handle.call_count == 0
```

- [ ] **Step 2: Write failing frontend polling/cancellation tests**

```typescript
it('stops polling and sends DELETE when the browser signal aborts', async () => {
  const controller = new AbortController();
  const pending = recognizeLocalDocument(file, controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/v1/jobs/job-1'), expect.objectContaining({ method: 'DELETE' }));
  expect(pollCount()).toBe(0);
});
```

- [ ] **Step 3: Run both suites and verify intended failures**

```powershell
cd "formula-ocr-engine"
uv run pytest "tests/unit/test_queue.py" -q
cd "../formula-ocr"
npm run test:run -- "src/test/unit/localDocumentClient.test.ts" "src/test/unit/workspaceQueue.test.ts" "src/test/unit/runtimeState.test.ts"
```

- [ ] **Step 4: Implement capped polling and exact cache identity**

```typescript
export type RecognitionCacheIdentity = {
  imageSha256: string;
  formulaType: FormulaType;
  preprocessingVersion: string;
  provider: ProviderType;
  engine: string;
  modelVersion: string;
};
```

Poll at 500 ms then back off to at most 2000 ms; stop on every terminal state, abort, network failure, or 15-minute deadline. Never retry `cancelled`, `invalid_input`, `unsupported_format`, `file_too_large`, `page_limit`, `queue_full`, or `model_unavailable` automatically.

- [ ] **Step 5: Verify no duplicate results or quota interaction**

```powershell
cd "formula-ocr"
npm run test:run -- "src/test/unit/localDocumentClient.test.ts" "src/test/unit/workspaceQueue.test.ts" "src/test/unit/runtimeState.test.ts" "src/test/unit/workerProxyRegression.test.ts"
cd "../formula-ocr-worker"
npx tsc --noEmit
```

The local Provider never calls Worker quota/payment endpoints. Existing cloud quota behavior must remain unchanged.

- [ ] **Step 6: Commit runtime reliability changes**

```powershell
git add -- "formula-ocr-engine/src/formula_ocr_engine/queue.py" "formula-ocr-engine/src/formula_ocr_engine/services/jobs.py" "formula-ocr-engine/tests/unit/test_queue.py" "formula-ocr/src/utils/localDocumentClient.ts" "formula-ocr/src/utils/taskQueue.ts" "formula-ocr/src/utils/runtimeState.ts" "formula-ocr/src/test/unit"
git commit -m "fix: bound and cancel local OCR work"
```

### Task 11: Phase 7 Workbench States and End-to-End Local Flows

**Files:**
- Modify: `formula-ocr/src/components/FormulaWorkbench.tsx`
- Modify: `formula-ocr/src/components/ProviderSelector.tsx`
- Modify: `formula-ocr/src/types/workspace.ts`
- Modify: `formula-ocr/src/App.css`
- Modify: `formula-ocr/src/test/unit/FormulaWorkbench.test.tsx`
- Create: `formula-ocr/e2e/local-engine.spec.ts`
- Create: `formula-ocr/e2e/fixtures/local-engine-routes.ts`

**Interfaces:**
- Consumes: capability states, formula response states, document job states/progress.
- Produces: distinct UI for service unavailable, model loading, queue full, no formula, OCR failed, network/auth/quota Provider error, needs review, cancelled, and success.

- [ ] **Step 1: Write failing component tests for status distinctions**

```tsx
it.each([
  ['no_formula', '未检测到公式'],
  ['ocr_failed', '已检测到区域，但 OCR 失败'],
  ['needs_review', '结果需复核'],
  ['cancelled', '已取消'],
])('renders %s without collapsing it into generic failure', async (status, label) => {
  render(<FormulaWorkbenchHarness result={{ status }} />);
  expect(await screen.findByText(label)).toBeVisible();
});
```

- [ ] **Step 2: Run the tests and verify current generic-state failures**

```powershell
cd "formula-ocr"
npm run test:run -- "src/test/unit/FormulaWorkbench.test.tsx"
```

- [ ] **Step 3: Connect local PDF jobs only when the selected local capability advertises them**

```typescript
const strategy = provider === 'local' && capabilities.document.available
  ? 'local-document-job'
  : 'browser-source-and-region-pipeline';
```

Keep Markdown and DOCX source parsing in-browser. Preserve page/source metadata when converting local document results into `WorkspaceFormulaItem`. Do not auto-fallback to a cloud Provider.

- [ ] **Step 4: Add Playwright route-controlled E2E cases**

```typescript
test('uploads image, receives needs-review result, edits and exports it', async ({ page }) => {
  await installLocalEngineRoutes(page, { recognition: 'needs-review' });
  await page.goto('/');
  await page.getByLabel('添加图片或文献').setInputFiles('e2e/fixtures/formula.png');
  await page.getByRole('button', { name: '识别全部' }).click();
  await expect(page.getByText('结果需复核')).toBeVisible();
  await page.getByLabel('LaTeX 编辑器').fill('E=mc^2');
  await expect(page.getByText('人工修改')).toBeVisible();
});
```

Cover image success, invalid output, model unavailable, queue full, cancel, PDF progress/completion, PDF cancellation, Markdown source preservation, DOCX OMML/image separation, export, and 390×844 layout.

- [ ] **Step 5: Run browser and frontend quality gates**

```powershell
npm run lint
npm run test:run
npm run build
npx playwright test "e2e/local-engine.spec.ts"
```

Record console errors/warnings, overflow checks, and screenshots under `formula-ocr/output/playwright/local-engine/`. Do not commit browser caches or transient Playwright state.

- [ ] **Step 6: Commit the verified interaction states**

```powershell
git add -- "formula-ocr/src/components/FormulaWorkbench.tsx" "formula-ocr/src/components/ProviderSelector.tsx" "formula-ocr/src/types/workspace.ts" "formula-ocr/src/App.css" "formula-ocr/src/test/unit/FormulaWorkbench.test.tsx" "formula-ocr/e2e/local-engine.spec.ts" "formula-ocr/e2e/fixtures/local-engine-routes.ts"
git commit -m "feat: expose local OCR job states in workbench"
```

### Task 12: Phase 8 Commercial-Safe Fixtures, Notices, and Release Gates

**Files:**
- Create: `formula-ocr-engine/README.md`
- Create: `formula-ocr-engine/THIRD_PARTY_NOTICES.md`
- Create: `formula-ocr-engine/scripts/setup.ps1`
- Create: `formula-ocr-engine/scripts/start.ps1`
- Create: `formula-ocr-engine/scripts/doctor.ps1`
- Create: `repair-baseline/fixtures/synthetic-formula-v1/manifest.json`
- Create: `repair-baseline/fixtures/synthetic-formula-v1/render.ps1`
- Create: `repair-baseline/fixtures/private-real-pdf-v1/README.md`
- Remove in a normal commit after synthetic verification: `repair-baseline/fixtures/real-pdf-v1/crops/*.png`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `RELEASE_NOTES.md`
- Modify: `formula-ocr/README.md`
- Modify: `formula-ocr/ACCEPTANCE_TEST_GUIDE.md`
- Create: `repair-baseline/local-engine/FINAL_RELEASE_REPORT.md`

**Interfaces:**
- Consumes: verified package/model licenses, all phase reports, synthetic LaTeX source, final command output.
- Produces: reproducible install/start/doctor workflow, commercial notices, public synthetic fixtures, private benchmark routing, honest release documentation.

- [ ] **Step 1: Write failing doctor-script contract tests**

```powershell
& "formula-ocr-engine/scripts/doctor.ps1" -Json | ConvertFrom-Json | ForEach-Object {
  if ($_.python -notmatch '^3\.11\.') { throw "doctor did not select Python 3.11" }
  if ($_.bindHost -ne '127.0.0.1') { throw "unsafe bind host" }
}
```

The script output must include uv version, Python version, disk space, model cache state, port availability, CPU/GPU detection, and each engine capability without loading model weights.

- [ ] **Step 2: Generate synthetic public crops from human-authored LaTeX**

```powershell
& "repair-baseline/fixtures/synthetic-formula-v1/render.ps1"
node --test "repair-baseline/evaluate-real-pdf.test.mjs"
```

Verify every generated PNG hash is listed in the synthetic manifest and every expected LaTeX renders successfully. Keep the real PDFs/pages/crops in a gitignored private directory for local benchmarking.

- [ ] **Step 3: Remove paper-derived public crops only after synthetic fixtures pass**

```powershell
git rm -- "repair-baseline/fixtures/real-pdf-v1/crops/*.png"
git add -- ".gitignore" "repair-baseline/fixtures/synthetic-formula-v1" "repair-baseline/fixtures/private-real-pdf-v1/README.md"
git diff --cached --check
```

Do not rewrite Git history or force-push. Document that earlier revisions contained small evaluation excerpts and that current public releases use generated samples.

- [ ] **Step 4: Record exact code and model licensing evidence**

```markdown
| Component | Exact version/model | Code license | Weight license | Source URL | Commercial-use decision |
|---|---|---|---|---|---|
| PaddleOCR | locked version | Apache-2.0 | verified upstream terms | official URL | enabled/disabled with reason |
| PP-FormulaNet-S | exact artifact | recorded terms | recorded terms | official URL | enabled/disabled with reason |
| Pix2Text | locked version | MIT | per-model recorded terms | official URL | enabled/disabled with reason |
| MFD/MFR 1.5 | exact artifacts | recorded terms | recorded terms | official URL | enabled/disabled with reason |
```

Copy required Apache/MIT notices into the distribution. “Open source” alone is not sufficient evidence for model-weight commercial use.

- [ ] **Step 5: Run the complete deterministic release gate**

```powershell
cd "formula-ocr-engine"
uv sync --python 3.11 --extra dev
uv run pytest -m "not model" -q
uv run ruff check .
uv run mypy "src/formula_ocr_engine"
uv run pip-audit

cd "../formula-ocr"
npm ci
npm run lint
npm run test:run
npm run build
npm audit --omit=dev --audit-level=high
npx playwright test "e2e/local-engine.spec.ts"

cd "../formula-ocr-worker"
npm ci
npx tsc --noEmit
npm audit --omit=dev --audit-level=high
```

- [ ] **Step 6: Run and report model-backed release gates separately**

```powershell
cd "formula-ocr-engine"
$env:RUN_MODEL_TESTS="1"
uv run --extra paddle --extra pix2text pytest -m model -v
uv run python "scripts/run_formula_benchmark.py" --manifest "../repair-baseline/fixtures/private-real-pdf-v1/manifest.json" --variants original --output "../repair-baseline/local-engine/final-formula-results.json"
uv run python "scripts/run_detection_benchmark.py" --manifest "../repair-baseline/fixtures/private-real-pdf-v1/manifest.json" --output "../repair-baseline/local-engine/final-detection-results.json"
Remove-Item Env:RUN_MODEL_TESTS
```

Report product-valid ≥30/33, human-acceptable ≥24/33, detection precision/recall each ≥0.70 at IoU 0.5, formula CPU P95 ≤5 s, cancellation behavior, and long-PDF peak memory as independent gates. A missed gate keeps that feature opt-in and is written verbatim in the release report.

- [ ] **Step 7: Update all public claims from current evidence only**

```markdown
- State the exact date, machine, model versions, sample counts, commands, and measured values.
- Mark unsupported/unmeasured behavior explicitly.
- Remove “90–95% accuracy”, “100% passed”, “production ready”, or equivalent claims unless the current recorded gates prove them.
- Keep detection, OCR, document parsing, runtime, and UI results in separate sections.
```

- [ ] **Step 8: Commit, push, and verify GitHub delivery**

```powershell
git add -- "formula-ocr-engine" "repair-baseline" ".gitignore" "README.md" "PROJECT_STATUS.md" "RELEASE_NOTES.md" "formula-ocr/README.md" "formula-ocr/ACCEPTANCE_TEST_GUIDE.md"
git diff --cached --check
git status --short
git commit -m "feat: ship measured local formula OCR engine"
git push origin main
git rev-parse HEAD
git rev-parse origin/main
```

GitHub Pages publishes only the static frontend; the user runs the loopback companion service locally. A GitHub Actions billing lock must be reported as a deployment blocker, not bypassed or described as a successful Pages deployment.

## Final Stop Conditions

- Stop release if any deterministic quality command fails.
- Stop enabling an adapter if its model-weight commercial license is unresolved.
- Stop automatic formula detection if either measured precision or recall is below 0.70.
- Stop recommending local OCR if product-valid, human-acceptable, or P95 gates fail.
- Stop PDF job release if cancellation publishes a late result or peak memory grows without a bound on the 85-page fixture.
- Preserve and report a working manual selection/source-formula path even when model gates fail.
