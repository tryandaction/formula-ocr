from __future__ import annotations

import base64
import importlib
from io import BytesIO

import httpx
import pytest
from PIL import Image


def load_detection_stack():
    try:
        return (
            importlib.import_module("formula_ocr_engine.app"),
            importlib.import_module("formula_ocr_engine.config"),
            importlib.import_module("formula_ocr_engine.contracts"),
            importlib.import_module("formula_ocr_engine.model_manager"),
        )
    except ModuleNotFoundError as error:
        pytest.fail(f"detection API is not implemented: {error}")


def page_data_url() -> str:
    output = BytesIO()
    Image.new("RGB", (100, 60), "white").save(output, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(output.getvalue()).decode('ascii')}"


@pytest.mark.asyncio
async def test_detection_api_returns_source_pixel_regions_without_ocr() -> None:
    app_module, config_module, contracts, manager_module = load_detection_stack()

    class DetectionEngine:
        engine_id = "pix2text-mfd-1.5"

        def detect(self, image: Image.Image):
            return [contracts.DetectionRegion(
                id="region-1", x=10, y=12, width=30, height=20, confidence=0.9,
                formulaType="display", detectorVersion=self.engine_id,
            )]

    manager = manager_module.ModelManager(detection_factory=DetectionEngine)
    app = app_module.create_app(config_module.Settings(), model_manager=manager)
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/detect", json={
            "requestId": "detect-1",
            "image": page_data_url(),
            "mime": "image/png",
            "source": {"kind": "pdf", "fileName": "paper.pdf", "pageNumber": 2},
        })

    assert response.status_code == 200
    assert response.json() == {
        "requestId": "detect-1",
        "status": "success",
        "engine": "pix2text-mfd-1.5",
        "processingTime": response.json()["processingTime"],
        "regions": [{
            "id": "region-1", "x": 10, "y": 12, "width": 30, "height": 20,
            "confidence": 0.9, "formulaType": "display", "detectorVersion": "pix2text-mfd-1.5",
        }],
    }
