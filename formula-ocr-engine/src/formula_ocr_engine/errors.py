from __future__ import annotations

from formula_ocr_engine.contracts import ErrorClass


class EngineError(Exception):
    def __init__(self, error_class: ErrorClass, message: str) -> None:
        super().__init__(message)
        self.error_class = error_class
        self.message = message
