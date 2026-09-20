from __future__ import annotations

import base64
import binascii
import re
from dataclasses import dataclass
from io import BytesIO
from typing import Protocol

from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

from formula_ocr_engine.contracts import ErrorClass
from formula_ocr_engine.errors import EngineError

DATA_URL = re.compile(r"^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$")
FORMAT_MIME = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
}


@dataclass(frozen=True)
class ImageLimits:
    encoded_bytes: int = 16 * 1024 * 1024
    decoded_pixels: int = 40_000_000


@dataclass(frozen=True)
class DecodedImage:
    image: Image.Image
    mime: str
    source_size: tuple[int, int]
    is_blank: bool


class ImageRequest(Protocol):
    @property
    def image(self) -> str: ...

    @property
    def mime(self) -> str: ...


def _decode_data_url(value: str, declared_mime: str, limit: int) -> bytes:
    if value.startswith(("http://", "https://")):
        raise EngineError(ErrorClass.INVALID_INPUT, "remote image URLs are not allowed")
    match = DATA_URL.fullmatch(value)
    if not match:
        raise EngineError(ErrorClass.INVALID_INPUT, "image must be a valid base64 data URL")
    embedded_mime, encoded = match.groups()
    if embedded_mime != declared_mime:
        raise EngineError(ErrorClass.UNSUPPORTED_FORMAT, "data URL MIME does not match request MIME")
    if len(encoded) > ((limit + 2) // 3) * 4 + 4:
        raise EngineError(ErrorClass.FILE_TOO_LARGE, "encoded image exceeds the byte limit")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise EngineError(ErrorClass.INVALID_INPUT, "image base64 is invalid") from error
    if len(raw) > limit:
        raise EngineError(ErrorClass.FILE_TOO_LARGE, "encoded image exceeds the byte limit")
    return raw


def _composite_rgb(image: Image.Image) -> Image.Image:
    if "A" not in image.getbands():
        return image.convert("RGB")
    rgba = image.convert("RGBA")
    background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    return Image.alpha_composite(background, rgba).convert("RGB")


def _is_uniform(image: Image.Image) -> bool:
    return all(variance == 0 for variance in ImageStat.Stat(image).var)


def decode_image(
    request: ImageRequest,
    *,
    limits: ImageLimits | None = None,
) -> DecodedImage:
    active_limits = limits or ImageLimits()
    raw = _decode_data_url(request.image, request.mime, active_limits.encoded_bytes)
    try:
        with Image.open(BytesIO(raw)) as opened:
            detected_mime = FORMAT_MIME.get(opened.format or "")
            if detected_mime != request.mime:
                raise EngineError(
                    ErrorClass.UNSUPPORTED_FORMAT,
                    "image magic bytes do not match request MIME",
                )
            source_size = opened.size
            if source_size[0] <= 0 or source_size[1] <= 0:
                raise EngineError(ErrorClass.INVALID_INPUT, "image dimensions must be positive")
            if source_size[0] * source_size[1] > active_limits.decoded_pixels:
                raise EngineError(ErrorClass.FILE_TOO_LARGE, "decoded image exceeds the pixel limit")
            opened.load()
            normalized = _composite_rgb(ImageOps.exif_transpose(opened))
    except EngineError:
        raise
    except Image.DecompressionBombError as error:
        raise EngineError(ErrorClass.FILE_TOO_LARGE, "decoded image exceeds the pixel limit") from error
    except (OSError, UnidentifiedImageError) as error:
        raise EngineError(ErrorClass.INVALID_INPUT, "image bytes are corrupt") from error
    return DecodedImage(
        image=normalized,
        mime=request.mime,
        source_size=source_size,
        is_blank=_is_uniform(normalized),
    )
