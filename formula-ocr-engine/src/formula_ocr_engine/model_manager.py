from __future__ import annotations

from collections.abc import Callable, Mapping
from threading import Lock

from formula_ocr_engine.contracts import ErrorClass, ModelState
from formula_ocr_engine.engines.base import FormulaEngine
from formula_ocr_engine.errors import EngineError


class ModelManager:
    def __init__(self, formula_factory: Callable[[], FormulaEngine] | None = None) -> None:
        self._formula_factory = formula_factory
        self._formula_engine: FormulaEngine | None = None
        self._formula_state = ModelState.NOT_LOADED
        self._formula_lock = Lock()

    def statuses(self) -> Mapping[str, str]:
        return {
            "formula": self._formula_state,
            "detection": ModelState.NOT_LOADED,
            "document": ModelState.NOT_LOADED,
        }

    def formula_available(self) -> bool:
        return self._formula_factory is not None

    def formula(self) -> FormulaEngine:
        if self._formula_engine is not None:
            return self._formula_engine
        if self._formula_factory is None:
            raise EngineError(ErrorClass.MODEL_UNAVAILABLE, "local formula model is unavailable")
        with self._formula_lock:
            if self._formula_engine is not None:
                return self._formula_engine
            self._formula_state = ModelState.LOADING
            try:
                self._formula_engine = self._formula_factory()
            except EngineError:
                self._formula_state = ModelState.FAILED
                raise
            except Exception as error:
                self._formula_state = ModelState.FAILED
                raise EngineError(
                    ErrorClass.MODEL_LOADING_FAILED,
                    "local formula model failed to load",
                ) from error
            self._formula_state = ModelState.READY
            return self._formula_engine
