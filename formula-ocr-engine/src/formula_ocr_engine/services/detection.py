from __future__ import annotations

from time import perf_counter
from typing import Protocol

from PIL import Image

from formula_ocr_engine.contracts import DetectionRegion, DetectionRequest, DetectionResponse
from formula_ocr_engine.image_input import ImageLimits, decode_image


class DetectionModel(Protocol):
    engine_id: str

    def detect(self, image: Image.Image) -> list[DetectionRegion]: ...


class DetectionModelProvider(Protocol):
    def detection(self) -> DetectionModel: ...


class DetectionService:
    def __init__(self, model_manager: DetectionModelProvider, limits: ImageLimits) -> None:
        self._model_manager = model_manager
        self._limits = limits

    def detect(self, request: DetectionRequest) -> DetectionResponse:
        started = perf_counter()
        decoded = decode_image(request, limits=self._limits)
        engine = self._model_manager.detection()
        regions = engine.detect(decoded.image)
        return DetectionResponse(
            requestId=request.requestId,
            engine=engine.engine_id,
            processingTime=round((perf_counter() - started) * 1000),
            regions=regions,
        )
