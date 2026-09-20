from __future__ import annotations

from collections.abc import Mapping

from formula_ocr_engine.contracts import ErrorClass
from formula_ocr_engine.errors import EngineError


class FakeModelManager:
    def __init__(self) -> None:
        self.load_calls = 0

    def statuses(self) -> Mapping[str, str]:
        return {
            "formula": "not_loaded",
            "detection": "not_loaded",
            "document": "not_loaded",
        }

    def assert_not_loaded(self) -> None:
        assert self.load_calls == 0

    def formula(self):
        raise EngineError(ErrorClass.MODEL_UNAVAILABLE, "Local formula model is not installed")

    def formula_available(self) -> bool:
        return False

    def detection_available(self) -> bool:
        return False

    def detection(self):
        raise EngineError(ErrorClass.MODEL_UNAVAILABLE, "Local detection model is not installed")
