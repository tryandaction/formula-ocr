from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from PIL import Image

from formula_ocr_engine.contracts import DetectionRegion


def load_benchmark():
    try:
        return importlib.import_module("formula_ocr_engine.detection_benchmark")
    except ModuleNotFoundError as error:
        pytest.fail(f"detection benchmark runner is not implemented: {error}")


def test_detection_benchmark_serializes_evaluator_boxes(tmp_path: Path) -> None:
    benchmark = load_benchmark()
    page = tmp_path / "page.png"
    Image.new("RGB", (100, 60), "white").save(page)

    class Engine:
        def detect(self, image: Image.Image):
            return [DetectionRegion(
                id="region-1", x=10, y=12, width=30, height=20, confidence=0.9,
                formulaType="display", detectorVersion="pix2text-mfd-1.5",
            )]

    result = benchmark.run_detection_benchmark(
        {"evaluatedPages": ["page.png"]},
        tmp_path,
        Engine(),
    )

    assert result == [{
        "pageImage": "page.png",
        "bbox": {"x": 10, "y": 12, "width": 30, "height": 20},
        "confidence": 0.9,
        "formulaType": "display",
        "detectorVersion": "pix2text-mfd-1.5",
        "processingTime": result[0]["processingTime"],
    }]
