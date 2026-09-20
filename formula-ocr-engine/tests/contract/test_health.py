from __future__ import annotations

import importlib

import httpx
import pytest
from conftest import FakeModelManager


def load_service():
    try:
        app_module = importlib.import_module("formula_ocr_engine.app")
        config_module = importlib.import_module("formula_ocr_engine.config")
    except ModuleNotFoundError as error:
        pytest.fail(f"local service is not implemented: {error}")
    return app_module.create_app, config_module.Settings


def test_settings_rejects_wildcard_cors_origin() -> None:
    _, settings_type = load_service()

    with pytest.raises(ValueError, match="wildcard CORS origin is not allowed"):
        settings_type(allowed_origins=("*",))


@pytest.mark.asyncio
async def test_health_does_not_load_models() -> None:
    create_app, settings_type = load_service()
    model_manager = FakeModelManager()
    transport = httpx.ASGITransport(app=create_app(settings_type(), model_manager=model_manager))

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "version": "0.1.0",
        "device": "cpu",
        "models": {
            "formula": "not_loaded",
            "detection": "not_loaded",
            "document": "not_loaded",
        },
    }
    model_manager.assert_not_loaded()


@pytest.mark.asyncio
async def test_capabilities_reports_limits_and_license_status() -> None:
    create_app, settings_type = load_service()
    transport = httpx.ASGITransport(
        app=create_app(settings_type(), model_manager=FakeModelManager())
    )

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/capabilities")

    assert response.status_code == 200
    body = response.json()
    assert body["supportedMimeTypes"] == [
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/pdf",
    ]
    assert body["limits"] == {
        "encodedImageBytes": 16 * 1024 * 1024,
        "decodedPixels": 40_000_000,
        "pdfBytes": 50 * 1024 * 1024,
        "pdfPages": 100,
        "queueCapacity": 8,
    }
    assert body["engines"] == [
        {
            "id": "paddle-pp-formulanet-s",
            "kind": "formula",
            "available": False,
            "state": "not_loaded",
            "license": "unverified",
        },
        {
            "id": "pix2text-mfd-1.5",
            "kind": "detection",
            "available": False,
            "state": "not_loaded",
            "license": "unverified",
        },
        {
            "id": "pix2text-document-1.1.4",
            "kind": "document",
            "available": False,
            "state": "not_loaded",
            "license": "unverified",
        },
    ]
