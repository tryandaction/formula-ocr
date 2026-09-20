from __future__ import annotations

import importlib

import pytest
from PIL import Image


def load_preprocessing():
    try:
        return importlib.import_module("formula_ocr_engine.preprocessing")
    except ModuleNotFoundError as error:
        pytest.fail(f"preprocessing variants are not implemented: {error}")


def decoded_image(image: Image.Image):
    image_input = importlib.import_module("formula_ocr_engine.image_input")
    return image_input.DecodedImage(
        image=image,
        mime="image/png",
        source_size=image.size,
        is_blank=False,
    )


def test_original_variant_preserves_pixels_and_geometry() -> None:
    preprocessing = load_preprocessing()
    image = Image.new("RGB", (7, 5), "white")
    image.putpixel((3, 2), (0, 0, 0))

    prepared = preprocessing.prepare_variants(decoded_image(image), "original")[0]

    assert prepared.image.tobytes() == image.tobytes()
    assert prepared.source_size == (7, 5)
    assert prepared.output_size == (7, 5)
    assert prepared.scale == 1
    assert prepared.padding == (0, 0, 0, 0)
    assert prepared.variant == "original"


def test_derived_variants_have_explicit_and_stable_pixel_contracts() -> None:
    preprocessing = load_preprocessing()
    image = Image.new("RGB", (4, 3), "white")
    image.putpixel((0, 0), (10, 80, 180))

    upscale, grayscale, binary = preprocessing.prepare_variants(
        decoded_image(image),
        ["upscale", "grayscale", "binary"],
    )

    assert upscale.output_size == (8, 6)
    assert upscale.scale == 2
    assert grayscale.image.getpixel((0, 0))[0] == grayscale.image.getpixel((0, 0))[1]
    assert set(binary.image.get_flattened_data()).issubset({(0, 0, 0), (255, 255, 255)})
