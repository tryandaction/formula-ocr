# Phase 4 MFD Detection Benchmark

Date: 2026-09-20
Machine: Windows, Intel i7-12700H, 16 GB RAM, CPU inference
Model: `breezedeus/pix2text-mfd-1.5`, ONNX, MIT license
Runtime: CnSTD 1.2.8, ONNX Runtime 1.30.0, OpenCV 4.10.0.84
Dataset: ten rendered pages and 33 display-formula boxes from `real-pdf-formulas-v1`

## Architecture Decision

Pix2Text 1.1.7 exposes mixed text/formula recognition publicly, but its public `score` for formulas comes from MFR rather than MFD. The locked source shows that MFD 1.5 is an ONNX model called through `cnstd.yolo_detector.YoloDetector`, whose raw result contains detector `score`, `type`, and four-corner `box` already mapped to source-image coordinates.

Installing the full Pix2Text package introduced `transformers 4.57.6`, which had eight audit findings in the current advisory database. The production extra was therefore narrowed to CnSTD/ONNX plus the official `breezedeus/pix2text-mfd-1.5` model. The unnecessary Pix2Text, Transformers, Optimum, MFR, and document aggregation dependencies were removed; `pip-audit` then returned no known vulnerabilities.

PaddleOCR and CnSTD originally resolved different OpenCV distributions/versions into the same `cv2` namespace. Both OpenCV distributions are locked to 4.10.0.84, and runtime verification confirms `cv2.__version__ == 4.10.0` and `setNumThreads` is available.

## Contract

- `/v1/detect` accepts the same validated local image boundary as recognition.
- Each result retains source-pixel `x/y/width/height`, detector confidence, inline/display type, and detector version.
- Detection does not run OCR.
- Out-of-bounds boxes are clamped; empty boxes and malformed result shapes fail closed as `invalid_output`.
- The MFD model loads lazily. `/health` does not load or download weights.

## Real Results

Complete MFD output (display plus inline):

| Metric | Value |
|---|---:|
| Predictions | 614 |
| Display / inline | 36 / 578 |
| TP / FP / FN at IoU 0.5 | 9 / 605 / 24 |
| Precision | 1.47% |
| Recall | 27.27% |
| Mean matched IoU | 0.6322 |

The benchmark ground truth contains display formulas, not every inline formula on each page. Filtering to display candidates gives:

| Metric | Value |
|---|---:|
| Predictions | 36 |
| TP / FP / FN at IoU 0.5 | 9 / 27 / 24 |
| Precision | 25.00% |
| Recall | 27.27% |
| Mean matched IoU | 0.6322 |
| Page P50 / P95 | 1049 / 3016 ms |

Confidence threshold scan for display candidates:

| Confidence | Predictions | TP | Precision | Recall |
|---:|---:|---:|---:|---:|
| 0.25 | 36 | 9 | 25.00% | 27.27% |
| 0.40 | 36 | 9 | 25.00% | 27.27% |
| 0.50 | 35 | 8 | 22.86% | 24.24% |
| 0.60 | 34 | 7 | 20.59% | 21.21% |
| 0.70 | 33 | 7 | 21.21% | 21.21% |
| 0.80 | 33 | 7 | 21.21% | 21.21% |
| 0.90 | 25 | 6 | 24.00% | 18.18% |

No threshold approaches the 70% precision and 70% recall release gate. Threshold tuning stopped.

## Verification

| Command | Result |
|---|---|
| Deterministic detection tests | source coordinates, confidence, clamp, empty-box rejection, API and runner passed |
| Real MFD smoke | passed on `jandura-p4.png`; first run 30.34 s including download/startup |
| Ten-page benchmark | 10 pages, 614 complete candidates |
| `uv run pytest -q` | 36 passed, 2 model tests skipped by default |
| `uv run ruff check .` | passed |
| `uv run mypy src/formula_ocr_engine` | passed for 17 source files |
| `uv run pip-audit` | no known vulnerabilities; local unpublished package skipped |

## Decision

Keep `/v1/detect` as an explicit experimental capability for further evaluation, but do not route the product's automatic PDF detection through it. Manual selection and the existing source-text path remain required. Detection confidence is not OCR confidence, and neither complete nor display-only results satisfy the release gate.
