# Phase 1 Paddle Formula OCR Smoke Evidence

Date: 2026-09-20
Environment: Windows, Python 3.11.15, CPU-only Intel i7-12700H host, no CUDA
Sample: `repair-baseline/fixtures/real-pdf-v1/crops/jandura-p4-03.png`

## Locked Runtime

| Component | Version | Evidence |
|---|---:|---|
| `paddleocr` | 3.7.0 | `uv.lock` and `importlib.metadata` |
| `paddlepaddle` | 3.3.1 | `uv.lock` and `importlib.metadata` |
| `paddlex` | 3.7.2 | `uv.lock` and `importlib.metadata` |
| `tokenizers` | 0.22.2 | required by `UniMERNetDecode` during initialization |
| `ftfy` | 6.3.1 | required by PaddleX formula post-processing |
| Model | PP-FormulaNet-S | cached under the PaddleX official model cache |

The Paddle extra is now explicit in `formula-ocr-engine/pyproject.toml` and the lock file. `uv run pip-audit` reported no known vulnerabilities; the local package itself is skipped because it is not published to PyPI.

## License Evidence

- PaddleOCR repository: Apache License 2.0.
- PP-FormulaNet-S model card: Apache-2.0.
- Source links: `https://github.com/PaddlePaddle/PaddleOCR`, `https://huggingface.co/PaddlePaddle/PP-FormulaNet-S`.
- This is evidence for the code/model artifact used in this smoke, not a blanket license conclusion for every transitive package or future model. The release task must still generate `THIRD_PARTY_NOTICES.md` with all locked package licenses.

## Execution Evidence

### Attempt 1: dependency boundary failure

Command:

```powershell
$env:RUN_MODEL_TESTS='1'
uv run pytest "tests/integration/test_recognition_api.py::test_real_paddle_model_smoke_is_opt_in" -v
```

Observed: PP-FormulaNet-S downloaded its six official files in about 50 seconds, then initialization failed because PaddleX could not import `tokenizers`. No inference result was produced. The test failed after 76.26 seconds.

### Attempt 2: decoder post-processing dependency failure

After adding `tokenizers>=0.19,<1` and syncing, the model initialized and reached CPU inference. Post-processing failed because PaddleX dynamically imported `ftfy`, which was not declared by the resolved installation. No accepted smoke result was produced. The test failed after 10.53 seconds.

### Attempt 3: successful real inference

After adding `ftfy>=6,<7` and syncing, the same opt-in test passed:

```text
1 passed, 1 warning in 9.46s
```

The warning was Paddle's missing `ccache` notice. It did not prevent inference.

A second diagnostic run with cached model files recorded:

```json
{
  "python": "3.11.15",
  "paddleocr": "3.7.0",
  "paddlepaddle": "3.3.1",
  "paddlex": "3.7.2",
  "model": "PP-FormulaNet-S",
  "sample": "jandura-p4-03",
  "initMs": 11615,
  "inferenceMs": 1145,
  "latex": "U(T)\\left|q\\right>=e^{i\\xi_{q}}\\left|q\\right>.\\qquad\\qquad\\quad(3)"
}
```

The output is non-empty and proves the adapter can read a real Paddle result. It is not an accuracy result: it includes a visible equation number and has not been compared by the Phase 1 evaluator to all 33 human ground-truth formulas.

## Current Decision

The Paddle adapter is runnable but remains opt-in. It must not be labeled recommended, production-ready, or accurate until Task 5 runs the full 33-sample benchmark and human review. The first smoke output also confirms that result cleaning needs an explicit equation-number policy; that belongs in the benchmark/evaluation phase rather than an unmeasured prompt or string patch.
