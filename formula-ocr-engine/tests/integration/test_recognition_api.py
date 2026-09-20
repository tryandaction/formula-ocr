from __future__ import annotations

import base64
import importlib
import os
from io import BytesIO
from pathlib import Path

import httpx
import pytest
from PIL import Image


def load_recognition_stack():
    try:
        app_module = importlib.import_module("formula_ocr_engine.app")
        config_module = importlib.import_module("formula_ocr_engine.config")
        base_module = importlib.import_module("formula_ocr_engine.engines.base")
        manager_module = importlib.import_module("formula_ocr_engine.model_manager")
    except ModuleNotFoundError as error:
        pytest.fail(f"recognition stack is not implemented: {error}")
    return app_module, config_module, base_module, manager_module


def png_data_url(*, with_mark: bool = True) -> str:
    output = BytesIO()
    image = Image.new("RGB", (20, 10), "white")
    if with_mark:
        image.putpixel((10, 5), (0, 0, 0))
    image.save(output, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(output.getvalue()).decode('ascii')}"


def recognition_request(image: str) -> dict[str, object]:
    return {
        "requestId": "recognition-api-1",
        "image": image,
        "mime": "image/png",
        "formulaType": "physics",
        "mode": "single",
        "source": {"kind": "image", "fileName": "formula.png"},
    }


@pytest.mark.asyncio
async def test_recognition_returns_structured_local_result() -> None:
    app_module, config_module, base_module, manager_module = load_recognition_stack()

    class FormulaEngine:
        engine_id = "formula-stub"

        def recognize(self, image: Image.Image, formula_type: str, mode: str):
            return base_module.EngineRecognition(
                latex=r"E=mc^2",
                formulas=[r"E=mc^2"],
                uncertainties=[],
            )

    manager = manager_module.ModelManager(formula_factory=FormulaEngine)
    app = app_module.create_app(config_module.Settings(), model_manager=manager)
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/recognize", json=recognition_request(png_data_url()))

    assert response.status_code == 200
    body = response.json()
    assert body["requestId"] == "recognition-api-1"
    assert body["success"] is True
    assert body["status"] == "success"
    assert body["latex"] == r"E=mc^2"
    assert body["formulas"] == [{"latex": r"E=mc^2", "uncertainties": []}]
    assert body["formulaCount"] == 1
    assert body["engine"] == "formula-stub"
    assert body["provider"] == "local"
    assert body["processingTime"] >= 0


@pytest.mark.asyncio
async def test_blank_image_returns_no_formula_without_loading_model() -> None:
    app_module, config_module, _, manager_module = load_recognition_stack()
    manager = manager_module.ModelManager(
        formula_factory=lambda: pytest.fail("blank image must not load the model")
    )
    app = app_module.create_app(config_module.Settings(), model_manager=manager)
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/recognize", json=recognition_request(png_data_url(with_mark=False))
        )

    assert response.status_code == 200
    assert response.json()["status"] == "no_formula"
    assert response.json()["formulaCount"] == 0
    assert manager.statuses()["formula"] == "not_loaded"


@pytest.mark.asyncio
async def test_remote_image_is_rejected_as_invalid_input() -> None:
    app_module, config_module, _, manager_module = load_recognition_stack()
    app = app_module.create_app(config_module.Settings(), model_manager=manager_module.ModelManager())
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/recognize",
            json=recognition_request("https://example.com/formula.png"),
        )

    assert response.status_code == 400
    assert response.json()["errorClass"] == "invalid_input"


@pytest.mark.asyncio
async def test_default_app_uses_lazy_paddle_factory(monkeypatch) -> None:
    app_module, config_module, base_module, _ = load_recognition_stack()

    class FormulaEngine:
        engine_id = "default-formula-stub"

        def recognize(self, image: Image.Image, formula_type: str, mode: str):
            return base_module.EngineRecognition(latex="x", formulas=["x"])

    monkeypatch.setattr(
        app_module,
        "create_paddle_formula_engine",
        FormulaEngine,
        raising=False,
    )
    app = app_module.create_app(config_module.Settings())
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        health = await client.get("/health")
        response = await client.post("/v1/recognize", json=recognition_request(png_data_url()))

    assert health.json()["models"]["formula"] == "not_loaded"
    assert response.status_code == 200
    assert response.json()["engine"] == "default-formula-stub"


@pytest.mark.model
def test_real_paddle_model_smoke_is_opt_in() -> None:
    if not os.environ.get("RUN_MODEL_TESTS"):
        pytest.skip("set RUN_MODEL_TESTS=1 to download and run model weights")
    if not bool(importlib.util.find_spec("paddleocr")):
        pytest.skip("install the paddle extra to run the real-model smoke test")
    if not bool(importlib.util.find_spec("paddle")):
        pytest.skip("PaddlePaddle runtime is not installed")
    paddle_formula = importlib.import_module("formula_ocr_engine.engines.paddle_formula")
    crop = (
        Path(__file__).parents[3]
        / "repair-baseline"
        / "fixtures"
        / "real-pdf-v1"
        / "crops"
        / "jandura-p4-03.png"
    )
    engine = paddle_formula.create_paddle_formula_engine()

    with Image.open(crop) as image:
        result = engine.recognize(image.convert("RGB"), "physics", "single")

    assert result.latex.strip()
    assert result.formulas == [result.latex]
