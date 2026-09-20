from __future__ import annotations

from time import perf_counter
from typing import Protocol

from formula_ocr_engine.contracts import (
    FormulaResult,
    RecognitionRequest,
    RecognitionResponse,
    RecognitionStatus,
)
from formula_ocr_engine.engines.base import FormulaEngine
from formula_ocr_engine.image_input import ImageLimits, decode_image
from formula_ocr_engine.preprocessing import prepare_variants


class FormulaModelProvider(Protocol):
    def formula(self) -> FormulaEngine: ...


class RecognitionService:
    def __init__(self, model_manager: FormulaModelProvider, limits: ImageLimits) -> None:
        self._model_manager = model_manager
        self._limits = limits

    def recognize(self, request: RecognitionRequest) -> RecognitionResponse:
        started = perf_counter()
        decoded = decode_image(request, limits=self._limits)
        if decoded.is_blank:
            return RecognitionResponse(
                requestId=request.requestId,
                success=False,
                status=RecognitionStatus.NO_FORMULA,
                latex="",
                formulas=[],
                formulaCount=0,
                uncertainties=[],
                engine="not_loaded",
                processingTime=round((perf_counter() - started) * 1000),
            )
        prepared = prepare_variants(decoded, "original")[0]
        engine = self._model_manager.formula()
        result = engine.recognize(
            prepared.image,
            request.formulaType.value,
            request.mode.value,
        )
        formulas = [FormulaResult(latex=latex) for latex in result.formulas]
        return RecognitionResponse(
            requestId=request.requestId,
            success=True,
            status=(
                RecognitionStatus.NEEDS_REVIEW
                if result.uncertainties
                else RecognitionStatus.SUCCESS
            ),
            latex=result.latex,
            formulas=formulas,
            formulaCount=len(formulas),
            uncertainties=result.uncertainties,
            confidence=result.confidence,
            engine=engine.engine_id,
            processingTime=round((perf_counter() - started) * 1000),
        )
