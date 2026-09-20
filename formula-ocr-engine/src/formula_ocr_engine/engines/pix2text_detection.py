from __future__ import annotations

import importlib
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Literal, Protocol, cast

import numpy as np
from PIL import Image

from formula_ocr_engine.contracts import DetectionRegion, ErrorClass
from formula_ocr_engine.errors import EngineError


class RawDetector(Protocol):
    def __call__(self, image: Image.Image, **kwargs: object) -> list[dict[str, object]]: ...


def create_pix2text_detection_engine() -> Pix2TextMfdEngine:
    try:
        hf_hub_download = importlib.import_module("huggingface_hub").hf_hub_download
        yolo_detector = importlib.import_module("cnstd.yolo_detector").YoloDetector
    except (AttributeError, ImportError) as error:
        raise EngineError(
            ErrorClass.MODEL_UNAVAILABLE,
            "Pix2Text MFD detection dependencies are not installed",
        ) from error
    model_path = hf_hub_download(
        repo_id="breezedeus/pix2text-mfd-1.5",
        filename="pix2text-mfd-1.5.onnx",
    )
    detector = yolo_detector(model_path=str(Path(model_path)), device="cpu")
    return Pix2TextMfdEngine(cast(RawDetector, detector))


def _number(value: object, name: str) -> float:
    if not isinstance(value, (int, float, np.number)):
        raise EngineError(ErrorClass.INVALID_OUTPUT, f"detector {name} is invalid")
    return float(value)


def _region(
    raw: Mapping[str, object],
    index: int,
    image_size: tuple[int, int],
) -> DetectionRegion:
    box = np.asarray(raw.get("box"))
    if box.shape != (4, 2):
        raise EngineError(ErrorClass.INVALID_OUTPUT, "detector box must have four points")
    width, height = image_size
    x1 = max(0, min(width, round(float(np.min(box[:, 0])))))
    y1 = max(0, min(height, round(float(np.min(box[:, 1])))))
    x2 = max(0, min(width, round(float(np.max(box[:, 0])))))
    y2 = max(0, min(height, round(float(np.max(box[:, 1])))))
    if x2 <= x1 or y2 <= y1:
        raise EngineError(ErrorClass.INVALID_OUTPUT, "detector returned an empty box")
    raw_type = raw.get("type")
    formula_type: Literal["display", "inline", "unknown"] = (
        "display" if raw_type == "isolated" else "inline" if raw_type == "embedding" else "unknown"
    )
    return DetectionRegion(
        id=f"region-{index}",
        x=x1,
        y=y1,
        width=x2 - x1,
        height=y2 - y1,
        confidence=_number(raw.get("score"), "score"),
        formulaType=formula_type,
        detectorVersion="pix2text-mfd-1.5",
    )


class Pix2TextMfdEngine:
    engine_id = "pix2text-mfd-1.5"

    def __init__(self, detector: RawDetector) -> None:
        self._detector = detector

    def detect(self, image: Image.Image) -> list[DetectionRegion]:
        resized_shape = (round(image.height * 768 / image.width), 768)
        raw_regions = self._detector(image, resized_shape=resized_shape)
        if not isinstance(raw_regions, Sequence):
            raise EngineError(ErrorClass.INVALID_OUTPUT, "detector result must be a sequence")
        return [_region(raw, index, image.size) for index, raw in enumerate(raw_regions, start=1)]
