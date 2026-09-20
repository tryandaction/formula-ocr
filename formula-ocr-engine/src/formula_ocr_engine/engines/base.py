from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from PIL import Image

from formula_ocr_engine.contracts import DetectionRegion


@dataclass(frozen=True)
class EngineRecognition:
    latex: str
    formulas: list[str]
    uncertainties: list[str] = field(default_factory=list)
    confidence: float | None = None


class FormulaEngine(Protocol):
    engine_id: str

    def recognize(
        self,
        image: Image.Image,
        formula_type: str,
        mode: str,
    ) -> EngineRecognition: ...


class DetectionEngine(Protocol):
    engine_id: str

    def detect(self, image: Image.Image) -> list[DetectionRegion]: ...
