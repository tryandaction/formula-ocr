from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from time import perf_counter
from typing import Protocol

from PIL import Image

from formula_ocr_engine.contracts import DetectionRegion


class DetectionBenchmarkEngine(Protocol):
    def detect(self, image: Image.Image) -> list[DetectionRegion]: ...


def run_detection_benchmark(
    manifest: Mapping[str, object],
    repository_root: Path,
    engine: DetectionBenchmarkEngine,
) -> list[dict[str, object]]:
    pages = manifest.get("evaluatedPages")
    if not isinstance(pages, list) or not all(isinstance(page, str) for page in pages):
        raise TypeError("manifest evaluatedPages must be a string list")
    predictions: list[dict[str, object]] = []
    for page_image in pages:
        started = perf_counter()
        with Image.open(repository_root / page_image) as opened:
            regions = engine.detect(opened.convert("RGB"))
        elapsed = round((perf_counter() - started) * 1000)
        for region in regions:
            predictions.append({
                "pageImage": page_image,
                "bbox": {
                    "x": region.x,
                    "y": region.y,
                    "width": region.width,
                    "height": region.height,
                },
                "confidence": region.confidence,
                "formulaType": region.formulaType,
                "detectorVersion": region.detectorVersion,
                "processingTime": elapsed,
            })
    return predictions
