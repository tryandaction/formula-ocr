from __future__ import annotations

import base64
import importlib
from io import BytesIO

import pytest
from PIL import Image

from formula_ocr_engine.contracts import ErrorClass, RecognitionRequest
from formula_ocr_engine.errors import EngineError


def load_image_input():
    try:
        return importlib.import_module("formula_ocr_engine.image_input")
    except ModuleNotFoundError as error:
        pytest.fail(f"image input boundary is not implemented: {error}")


def data_url(image: Image.Image, image_format: str, *, exif: Image.Exif | None = None) -> str:
    output = BytesIO()
    save_options = {"exif": exif} if exif is not None else {}
    image.save(output, format=image_format, **save_options)
    mime = {
        "PNG": "image/png",
        "JPEG": "image/jpeg",
        "WEBP": "image/webp",
    }[image_format]
    return f"data:{mime};base64,{base64.b64encode(output.getvalue()).decode('ascii')}"


def request(image: str, mime: str = "image/png") -> RecognitionRequest:
    return RecognitionRequest(
        requestId="input-test",
        image=image,
        mime=mime,
        formulaType="auto",
        mode="single",
        source={"kind": "image"},
    )


def raw_data_url(raw: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"


def test_remote_urls_are_rejected_before_decode() -> None:
    image_input = load_image_input()

    with pytest.raises(EngineError) as captured:
        image_input.decode_image(request("https://example.com/formula.png"))

    assert captured.value.error_class == ErrorClass.INVALID_INPUT


def test_magic_bytes_must_match_declared_mime() -> None:
    image_input = load_image_input()
    webp = data_url(Image.new("RGB", (8, 8), "white"), "WEBP")

    with pytest.raises(EngineError) as captured:
        image_input.decode_image(request(webp, mime="image/png"))

    assert captured.value.error_class == ErrorClass.UNSUPPORTED_FORMAT


def test_decoded_pixel_limit_is_enforced_before_pixel_load() -> None:
    image_input = load_image_input()
    png = data_url(Image.new("RGB", (100, 100), "white"), "PNG")
    limits = image_input.ImageLimits(encoded_bytes=1_000_000, decoded_pixels=9_999)

    with pytest.raises(EngineError) as captured:
        image_input.decode_image(request(png), limits=limits)

    assert captured.value.error_class == ErrorClass.FILE_TOO_LARGE


def test_pillow_decompression_bomb_is_classified_as_file_too_large(monkeypatch) -> None:
    image_input = load_image_input()
    png = data_url(Image.new("RGB", (100, 100), "white"), "PNG")
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 10)

    with pytest.raises(EngineError) as captured:
        image_input.decode_image(request(png))

    assert captured.value.error_class == ErrorClass.FILE_TOO_LARGE


def test_encoded_byte_limit_is_enforced_before_image_open() -> None:
    image_input = load_image_input()
    limits = image_input.ImageLimits(encoded_bytes=3, decoded_pixels=10_000)

    with pytest.raises(EngineError) as captured:
        image_input.decode_image(request(raw_data_url(b"four")), limits=limits)

    assert captured.value.error_class == ErrorClass.FILE_TOO_LARGE


def test_invalid_base64_is_classified_as_invalid_input() -> None:
    image_input = load_image_input()

    with pytest.raises(EngineError) as captured:
        image_input.decode_image(request("data:image/png;base64,A==="))

    assert captured.value.error_class == ErrorClass.INVALID_INPUT


def test_corrupt_image_bytes_are_classified_as_invalid_input() -> None:
    image_input = load_image_input()

    with pytest.raises(EngineError) as captured:
        image_input.decode_image(request(raw_data_url(b"not-a-png")))

    assert captured.value.error_class == ErrorClass.INVALID_INPUT


def test_exif_orientation_is_applied() -> None:
    image_input = load_image_input()
    exif = Image.Exif()
    exif[274] = 6
    jpeg = data_url(Image.new("RGB", (4, 2), "white"), "JPEG", exif=exif)

    decoded = image_input.decode_image(request(jpeg, mime="image/jpeg"))

    assert decoded.source_size == (4, 2)
    assert decoded.image.size == (2, 4)


def test_transparent_pixels_are_composited_onto_white_and_blank_is_reported() -> None:
    image_input = load_image_input()
    transparent = data_url(Image.new("RGBA", (3, 3), (0, 0, 0, 0)), "PNG")

    decoded = image_input.decode_image(request(transparent))

    assert decoded.image.mode == "RGB"
    assert decoded.image.getpixel((1, 1)) == (255, 255, 255)
    assert decoded.is_blank is True
