# Third-Party Notices

Last verified: 2026-09-20

This file records the principal runtime packages and model artifacts deliberately selected for the local engine. It is not a substitute for legal advice. Redistributors must preserve the license and copyright notices required by each dependency and model.

| Component | Locked version/artifact | License evidence | Source | Commercial decision |
|---|---|---|---|---|
| PaddleOCR | 3.7.0 | Apache-2.0 in package/repository metadata | https://github.com/PaddlePaddle/PaddleOCR | enabled |
| PaddlePaddle | 3.3.1 | Apache-2.0 repository license | https://github.com/PaddlePaddle/Paddle | enabled |
| PaddleX | 3.7.2 | Apache-2.0 repository license | https://github.com/PaddlePaddle/PaddleX | enabled |
| PP-FormulaNet-S weights | Hugging Face revision downloaded by PaddleX | model card declares Apache-2.0 | https://huggingface.co/PaddlePaddle/PP-FormulaNet-S | enabled, experimental by measured quality |
| CnSTD | 1.2.8 | Apache-2.0 package/source headers | https://github.com/breezedeus/cnstd | enabled for optional detection |
| Pix2Text MFD 1.5 weights | revision `f470a885e0fca1d3d2bfa2a54991db7ae01f1861`, `pix2text-mfd-1.5.onnx` | model card declares MIT | https://huggingface.co/breezedeus/pix2text-mfd-1.5 | enabled as experimental endpoint; not automatic |
| ONNX Runtime | 1.30.0 | MIT repository license | https://github.com/microsoft/onnxruntime | enabled |
| FastAPI | 0.141.1 | MIT package/repository license | https://github.com/fastapi/fastapi | enabled |
| Pydantic | 2.13.5 | MIT package/repository license | https://github.com/pydantic/pydantic | enabled |
| Pillow | 12.3.0 | HPND license | https://github.com/python-pillow/Pillow | enabled |
| NumPy | 2.3.5 | BSD-3-Clause | https://github.com/numpy/numpy | enabled |
| Hugging Face Hub | 1.32.0 | Apache-2.0 | https://github.com/huggingface/huggingface_hub | enabled |

## Deliberately Disabled

- Full Pix2Text 1.1.7 PDF-to-Markdown is disabled. Its default resolved stack selected `transformers 4.57.6`, which had known audit findings on 2026-09-20. Constraining to the audited Transformers 5.x line caused an import failure in Pix2Text's resolved Optimum integration. No compatible audited combination was demonstrated.
- MinerU is not bundled. Its separate commercial/attribution conditions were not accepted for this release.
- Mathpix, SimpleTex, GLM-OCR and other hosted APIs are not local dependencies and are not represented as free self-hosted engines.

## Redistribution

Distributions must include the applicable Apache License 2.0, MIT, BSD-3-Clause, HPND and other dependency notices produced from the locked environment. Model names and upstream trademarks must not be used to imply endorsement. Model accuracy claims must use this project's measured benchmark rather than upstream marketing metrics.
