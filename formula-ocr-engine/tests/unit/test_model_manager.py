from __future__ import annotations

import importlib
import time
from concurrent.futures import ThreadPoolExecutor

import pytest

from formula_ocr_engine.contracts import ErrorClass
from formula_ocr_engine.errors import EngineError


def load_model_manager():
    try:
        return importlib.import_module("formula_ocr_engine.model_manager")
    except ModuleNotFoundError as error:
        pytest.fail(f"model manager is not implemented: {error}")


class FormulaEngineStub:
    engine_id = "formula-stub"


def test_concurrent_first_requests_load_formula_model_once() -> None:
    model_manager = load_model_manager()
    calls = 0
    engine = FormulaEngineStub()

    def factory() -> FormulaEngineStub:
        nonlocal calls
        calls += 1
        time.sleep(0.02)
        return engine

    manager = model_manager.ModelManager(formula_factory=factory)

    with ThreadPoolExecutor(max_workers=4) as pool:
        loaded = list(pool.map(lambda _: manager.formula(), range(4)))

    assert loaded == [engine, engine, engine, engine]
    assert calls == 1
    assert manager.formula_available() is True
    assert manager.statuses()["formula"] == "ready"


def test_failed_formula_load_has_stable_error_and_state() -> None:
    model_manager = load_model_manager()

    def factory():
        raise RuntimeError("model files are missing")

    manager = model_manager.ModelManager(formula_factory=factory)

    with pytest.raises(EngineError) as captured:
        manager.formula()

    assert captured.value.error_class == ErrorClass.MODEL_LOADING_FAILED
    assert str(captured.value) == "local formula model failed to load"
    assert manager.statuses()["formula"] == "failed"


def test_missing_formula_factory_is_model_unavailable() -> None:
    model_manager = load_model_manager()
    manager = model_manager.ModelManager()

    assert manager.formula_available() is False

    with pytest.raises(EngineError) as captured:
        manager.formula()

    assert captured.value.error_class == ErrorClass.MODEL_UNAVAILABLE
