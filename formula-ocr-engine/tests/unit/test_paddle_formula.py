from __future__ import annotations

import importlib

import pytest
from PIL import Image

from formula_ocr_engine.contracts import ErrorClass
from formula_ocr_engine.errors import EngineError


def load_paddle_adapter():
    try:
        return importlib.import_module("formula_ocr_engine.engines.paddle_formula")
    except ModuleNotFoundError as error:
        pytest.fail(f"Paddle formula adapter is not implemented: {error}")


class FakeResult:
    def __init__(self, payload: object) -> None:
        self.json = payload


class FakePaddleModel:
    def __init__(self, payload: object) -> None:
        self.payload = payload

    def predict(self, *, input: object, batch_size: int):
        return [FakeResult(self.payload)]


def test_adapter_reads_official_rec_formula_result() -> None:
    paddle_formula = load_paddle_adapter()
    engine = paddle_formula.PaddleFormulaEngine(
        model=FakePaddleModel({"res": {"rec_formula": r"E=mc^2"}})
    )

    result = engine.recognize(Image.new("RGB", (20, 10), "white"), "physics", "single")

    assert result.latex == r"E=mc^2"
    assert result.formulas == [r"E=mc^2"]
    assert result.uncertainties == []


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"res": {}},
        {"res": {"rec_formula": ""}},
        {"res": {"rec_formula": ["x"]}},
    ],
)
def test_adapter_rejects_unknown_or_empty_result_shape(payload: object) -> None:
    paddle_formula = load_paddle_adapter()
    engine = paddle_formula.PaddleFormulaEngine(model=FakePaddleModel(payload))

    with pytest.raises(EngineError) as captured:
        engine.recognize(Image.new("RGB", (20, 10), "white"), "auto", "single")

    assert captured.value.error_class == ErrorClass.INVALID_OUTPUT
