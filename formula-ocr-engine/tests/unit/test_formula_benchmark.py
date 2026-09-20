from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from PIL import Image

from formula_ocr_engine.engines.base import EngineRecognition


def load_benchmark():
    try:
        return importlib.import_module("formula_ocr_engine.benchmark")
    except ModuleNotFoundError as error:
        pytest.fail(f"formula benchmark runner is not implemented: {error}")


class FakeClient:
    def recognize(self, sample: dict[str, object], variant: str) -> dict[str, object]:
        if sample["id"] == "failed":
            raise RuntimeError("model unavailable")
        return {
            "latex": "x^2",
            "status": "success",
            "errorClass": None,
            "processingTime": 12,
        }


class SlowClient(FakeClient):
    def recognize(self, sample: dict[str, object], variant: str) -> dict[str, object]:
        import time

        time.sleep(0.01)
        return super().recognize(sample, variant)


def test_benchmark_keeps_failures_and_variant_metadata() -> None:
    benchmark = load_benchmark()
    manifest = {
        "name": "fixture",
        "samples": [
            {"id": "success", "cropFile": "success.png", "formulaType": "math", "groundTruthLatex": "x^2"},
            {"id": "failed", "cropFile": "failed.png", "formulaType": "physics", "groundTruthLatex": "F=ma"},
        ],
    }

    report = benchmark.run_benchmark(manifest, FakeClient(), ["original"])

    assert [item["id"] for item in report["results"]] == ["success", "failed"]
    assert report["results"][0] == {
        "id": "success",
        "variant": "original",
        "latex": "x^2",
        "status": "success",
        "errorClass": None,
        "processingTime": 12,
    }
    assert report["results"][1]["status"] == "failed"
    assert report["results"][1]["errorClass"] == "internal"
    assert "groundTruthLatex" not in report["results"][0]


def test_benchmark_uses_wall_time_when_client_does_not_report_duration() -> None:
    benchmark = load_benchmark()
    manifest = {"name": "fixture", "samples": [{"id": "success", "cropFile": "x", "formulaType": "math"}]}

    report = benchmark.run_benchmark(manifest, SlowClient(), ["original"])

    assert report["results"][0]["processingTime"] >= 10


def test_paddle_crop_client_applies_requested_variant(tmp_path: Path) -> None:
    benchmark = load_benchmark()
    crop = tmp_path / "crop.png"
    Image.new("RGB", (4, 3), "white").save(crop)

    class RecordingEngine:
        def __init__(self) -> None:
            self.size = (0, 0)

        def recognize(self, image: Image.Image, formula_type: str, mode: str) -> EngineRecognition:
            self.size = image.size
            return EngineRecognition(latex="x", formulas=["x"])

    engine = RecordingEngine()
    client = benchmark.PaddleCropClient(tmp_path, engine)

    client.recognize({"id": "x", "cropFile": "crop.png", "formulaType": "math"}, "upscale")

    assert engine.size == (8, 6)
