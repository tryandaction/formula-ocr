from __future__ import annotations

import importlib
from collections.abc import Iterable, Mapping
from typing import Protocol, cast

import numpy as np
from PIL import Image

from formula_ocr_engine.contracts import ErrorClass
from formula_ocr_engine.engines.base import EngineRecognition
from formula_ocr_engine.errors import EngineError


class PaddleResult(Protocol):
    json: object


class PaddleModel(Protocol):
    def predict(self, *, input: object, batch_size: int) -> Iterable[PaddleResult]: ...


def create_paddle_formula_engine() -> PaddleFormulaEngine:
    try:
        formula_recognition = importlib.import_module("paddleocr").FormulaRecognition
    except (AttributeError, ImportError) as error:
        raise EngineError(
            ErrorClass.MODEL_UNAVAILABLE,
            "PaddleOCR formula dependencies are not installed",
        ) from error
    model = formula_recognition(
        model_name="PP-FormulaNet-S",
        device="cpu",
        engine="paddle_static",
        cpu_threads=8,
    )
    return PaddleFormulaEngine(model=cast(PaddleModel, model))


def _extract_formula(result: PaddleResult) -> str:
    payload = result.json
    if not isinstance(payload, Mapping):
        raise EngineError(ErrorClass.INVALID_OUTPUT, "Paddle result is not an object")
    nested = payload.get("res")
    if not isinstance(nested, Mapping):
        raise EngineError(ErrorClass.INVALID_OUTPUT, "Paddle result is missing res")
    formula = nested.get("rec_formula")
    if not isinstance(formula, str) or not formula.strip():
        raise EngineError(ErrorClass.INVALID_OUTPUT, "Paddle result is missing rec_formula")
    return formula.strip()


class PaddleFormulaEngine:
    engine_id = "paddle-pp-formulanet-s"

    def __init__(self, model: PaddleModel) -> None:
        self._model = model

    def recognize(
        self,
        image: Image.Image,
        formula_type: str,
        mode: str,
    ) -> EngineRecognition:
        del formula_type, mode
        predictions = iter(self._model.predict(input=np.asarray(image), batch_size=1))
        try:
            result = next(predictions)
        except StopIteration as error:
            raise EngineError(ErrorClass.INVALID_OUTPUT, "Paddle returned no result") from error
        latex = _extract_formula(result)
        return EngineRecognition(latex=latex, formulas=[latex])
