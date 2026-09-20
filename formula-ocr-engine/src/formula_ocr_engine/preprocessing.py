from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from time import perf_counter
from typing import Literal

from PIL import Image, ImageOps

from formula_ocr_engine.image_input import DecodedImage

PreprocessingVariant = Literal["original", "upscale", "grayscale", "binary"]


@dataclass(frozen=True)
class PreparedImage:
    image: Image.Image
    variant: PreprocessingVariant
    source_size: tuple[int, int]
    output_size: tuple[int, int]
    scale: float
    padding: tuple[int, int, int, int]
    processing_ms: int


def _otsu_threshold(image: Image.Image) -> int:
    histogram = image.histogram()
    total = sum(histogram)
    weighted_sum = sum(index * count for index, count in enumerate(histogram))
    background_weight = 0
    background_sum = 0
    best_variance = -1.0
    threshold = 127
    for index, count in enumerate(histogram):
        background_weight += count
        if background_weight == 0:
            continue
        foreground_weight = total - background_weight
        if foreground_weight == 0:
            break
        background_sum += index * count
        background_mean = background_sum / background_weight
        foreground_mean = (weighted_sum - background_sum) / foreground_weight
        variance = background_weight * foreground_weight * (background_mean - foreground_mean) ** 2
        if variance > best_variance:
            best_variance = variance
            threshold = index
    return threshold


def _prepare(image: Image.Image, variant: PreprocessingVariant) -> tuple[Image.Image, float]:
    if variant == "original":
        return image.copy(), 1.0
    if variant == "upscale":
        return (
            image.resize((image.width * 2, image.height * 2), Image.Resampling.LANCZOS),
            2.0,
        )
    grayscale = ImageOps.grayscale(image)
    if variant == "grayscale":
        return grayscale.convert("RGB"), 1.0
    if variant == "binary":
        threshold = _otsu_threshold(grayscale)
        return grayscale.point(lambda value: 255 if value > threshold else 0).convert("RGB"), 1.0
    raise ValueError(f"unknown preprocessing variant: {variant}")


def prepare_variants(
    decoded: DecodedImage,
    policy: PreprocessingVariant | Sequence[PreprocessingVariant],
) -> list[PreparedImage]:
    variants = [policy] if isinstance(policy, str) else list(policy)
    if not variants:
        raise ValueError("at least one preprocessing variant is required")
    prepared: list[PreparedImage] = []
    for variant in variants:
        started = perf_counter()
        image, scale = _prepare(decoded.image, variant)
        prepared.append(
            PreparedImage(
                image=image,
                variant=variant,
                source_size=decoded.image.size,
                output_size=image.size,
                scale=scale,
                padding=(0, 0, 0, 0),
                processing_ms=max(0, round((perf_counter() - started) * 1000)),
            )
        )
    return prepared
