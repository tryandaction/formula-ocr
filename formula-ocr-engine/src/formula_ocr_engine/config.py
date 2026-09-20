from __future__ import annotations

import os

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True)

    version: str = "0.1.0"
    device: str = "cpu"
    bind_host: str = "127.0.0.1"
    port: int = Field(default=8502, ge=1, le=65535)
    allowed_origins: tuple[str, ...] = (
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://tryandaction.github.io",
    )
    encoded_image_bytes: int = 16 * 1024 * 1024
    decoded_pixels: int = 40_000_000
    pdf_bytes: int = 50 * 1024 * 1024
    pdf_pages: int = 100
    queue_capacity: int = 8

    @field_validator("allowed_origins")
    @classmethod
    def reject_wildcard_origin(cls, origins: tuple[str, ...]) -> tuple[str, ...]:
        if "*" in origins:
            raise ValueError("wildcard CORS origin is not allowed")
        return origins

    @classmethod
    def from_environment(cls) -> Settings:
        origins = os.getenv("FORMULA_OCR_ALLOWED_ORIGINS")
        return cls(
            port=int(os.getenv("FORMULA_OCR_PORT", "8502")),
            allowed_origins=tuple(item.strip() for item in origins.split(",") if item.strip())
            if origins
            else cls.model_fields["allowed_origins"].default,
        )
