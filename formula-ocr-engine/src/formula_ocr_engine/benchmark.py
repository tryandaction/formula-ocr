from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from time import perf_counter
from typing import Protocol, cast

from PIL import Image

from formula_ocr_engine.engines.base import FormulaEngine
from formula_ocr_engine.image_input import DecodedImage
from formula_ocr_engine.preprocessing import PreprocessingVariant, prepare_variants


class BenchmarkClient(Protocol):
    def recognize(self, sample: dict[str, object], variant: str) -> dict[str, object]: ...


def run_benchmark(
    manifest: dict[str, object],
    client: BenchmarkClient,
    variants: Sequence[str],
) -> dict[str, object]:
    samples = manifest.get("samples")
    if not isinstance(samples, list):
        raise TypeError("manifest samples must be a list")
    results: list[dict[str, object]] = []
    for sample in samples:
        if not isinstance(sample, dict) or not isinstance(sample.get("id"), str):
            raise TypeError("each benchmark sample needs an id")
        for variant in variants:
            started = perf_counter()
            try:
                response = client.recognize(sample, variant)
                elapsed = round((perf_counter() - started) * 1000)
                reported_time = response.get("processingTime")
                item = {
                    "id": sample["id"],
                    "variant": variant,
                    "latex": response.get("latex", ""),
                    "status": response.get("status", "failed"),
                    "errorClass": response.get("errorClass"),
                    "processingTime": reported_time if isinstance(reported_time, int) and reported_time > 0 else elapsed,
                }
            except Exception:  # noqa: BLE001 - retain every per-sample model failure
                item = {
                    "id": sample["id"],
                    "variant": variant,
                    "latex": "",
                    "status": "failed",
                    "errorClass": "internal",
                    "processingTime": round((perf_counter() - started) * 1000),
                }
            results.append(item)
    return {
        "benchmark": manifest.get("name", "formula-benchmark"),
        "sampleCount": len(samples),
        "variants": list(variants),
        "results": results,
    }


class PaddleCropClient:
    def __init__(self, crop_root: Path, engine: FormulaEngine) -> None:
        self._crop_root = crop_root
        self._engine = engine

    def recognize(self, sample: dict[str, object], variant: str) -> dict[str, object]:
        crop_file = sample.get("cropFile")
        if not isinstance(crop_file, str):
            raise TypeError("sample cropFile is missing")
        if variant not in {"original", "upscale", "grayscale", "binary"}:
            raise ValueError(f"unknown preprocessing variant: {variant}")
        selected_variant = cast(PreprocessingVariant, variant)
        with Image.open(self._crop_root / crop_file) as opened:
            image = opened.convert("RGB")
            prepared = prepare_variants(
                DecodedImage(
                    image=image,
                    mime=Image.MIME.get(opened.format or "", "image/png"),
                    source_size=image.size,
                    is_blank=False,
                ),
                selected_variant,
            )[0]
            result = self._engine.recognize(
                prepared.image,
                str(sample.get("formulaType", "auto")),
                "single",
            )
        return {
            "latex": result.latex,
            "status": "success" if result.latex else "no_formula",
            "errorClass": None,
            "processingTime": 0,
        }
