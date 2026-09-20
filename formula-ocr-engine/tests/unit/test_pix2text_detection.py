from __future__ import annotations

import importlib
import os
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from formula_ocr_engine.contracts import ErrorClass
from formula_ocr_engine.errors import EngineError


def load_detection_adapter():
    try:
        return importlib.import_module("formula_ocr_engine.engines.pix2text_detection")
    except ModuleNotFoundError as error:
        pytest.fail(f"Pix2Text MFD adapter is not implemented: {error}")


class FakeDetector:
    def __init__(self, results: list[dict[str, object]]) -> None:
        self.results = results

    def __call__(self, image: Image.Image, **kwargs: object) -> list[dict[str, object]]:
        return self.results


def test_detection_boxes_remain_in_source_pixel_coordinates() -> None:
    detection = load_detection_adapter()
    engine = detection.Pix2TextMfdEngine(FakeDetector([{
        "box": np.array([[100, 50], [300, 50], [300, 150], [100, 150]]),
        "score": 0.91,
        "type": "isolated",
    }]))

    result = engine.detect(Image.new("RGB", (1200, 1800), "white"))

    assert result[0].model_dump() == {
        "id": "region-1",
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 100,
        "confidence": pytest.approx(0.91),
        "formulaType": "display",
        "detectorVersion": "pix2text-mfd-1.5",
    }


def test_detection_clamps_boxes_to_source_bounds() -> None:
    detection = load_detection_adapter()
    engine = detection.Pix2TextMfdEngine(FakeDetector([{
        "box": np.array([[-10, -5], [120, -5], [120, 80], [-10, 80]]),
        "score": 0.8,
        "type": "embedding",
    }]))

    result = engine.detect(Image.new("RGB", (100, 60), "white"))

    assert result[0].model_dump() | {"confidence": 0.8} == {
        "id": "region-1", "x": 0, "y": 0, "width": 100, "height": 60,
        "confidence": 0.8, "formulaType": "inline", "detectorVersion": "pix2text-mfd-1.5",
    }


def test_detection_rejects_empty_box_after_clamp() -> None:
    detection = load_detection_adapter()
    engine = detection.Pix2TextMfdEngine(FakeDetector([{
        "box": np.array([[110, 10], [120, 10], [120, 20], [110, 20]]),
        "score": 0.8,
        "type": "isolated",
    }]))

    with pytest.raises(EngineError) as captured:
        engine.detect(Image.new("RGB", (100, 60), "white"))

    assert captured.value.error_class == ErrorClass.INVALID_OUTPUT


@pytest.mark.model
def test_real_pix2text_mfd_smoke_is_opt_in() -> None:
    if not os.environ.get("RUN_MODEL_TESTS"):
        pytest.skip("set RUN_MODEL_TESTS=1 to download and run MFD weights")
    detection = load_detection_adapter()
    page = Path(__file__).parents[3] / "tmp" / "pdfs" / "accuracy-pages" / "jandura-p4.png"
    engine = detection.create_pix2text_detection_engine()

    with Image.open(page) as image:
        regions = engine.detect(image.convert("RGB"))
        width, height = image.size

    assert isinstance(regions, list)
    assert all(0 <= region.x < region.x + region.width <= width for region in regions)
    assert all(0 <= region.y < region.y + region.height <= height for region in regions)
    assert all(0 <= region.confidence <= 1 for region in regions)
