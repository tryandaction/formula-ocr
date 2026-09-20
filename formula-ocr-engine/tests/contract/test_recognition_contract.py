from __future__ import annotations

import base64
from io import BytesIO

import httpx
import pytest
from conftest import FakeModelManager
from PIL import Image
from test_health import load_service


def valid_nonblank_png() -> str:
    output = BytesIO()
    image = Image.new("RGB", (2, 2), "white")
    image.putpixel((0, 0), (0, 0, 0))
    image.save(output, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(output.getvalue()).decode('ascii')}"


@pytest.mark.asyncio
async def test_recognition_returns_stable_model_unavailable_response() -> None:
    create_app, settings_type = load_service()
    transport = httpx.ASGITransport(
        app=create_app(settings_type(), model_manager=FakeModelManager())
    )
    request = {
        "requestId": "ocr-contract-1",
        "image": valid_nonblank_png(),
        "mime": "image/png",
        "formulaType": "physics",
        "mode": "single",
        "source": {
            "kind": "image",
            "fileName": "formula.png",
        },
    }

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/recognize", json=request)

    assert response.status_code == 503
    assert response.json() == {
        "requestId": "ocr-contract-1",
        "success": False,
        "status": "failed",
        "latex": "",
        "formulas": [],
        "formulaCount": 0,
        "uncertainties": [],
        "confidence": None,
        "engine": "unavailable",
        "provider": "local",
        "processingTime": 0,
        "errorClass": "model_unavailable",
        "error": "Local formula model is not installed",
    }
