from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ModelState(StrEnum):
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    READY = "ready"
    FAILED = "failed"


class FormulaType(StrEnum):
    AUTO = "auto"
    MATH = "math"
    PHYSICS = "physics"
    CHEMISTRY = "chemistry"


class RecognitionMode(StrEnum):
    SINGLE = "single"
    MULTIPLE = "multiple"


class RecognitionStatus(StrEnum):
    SUCCESS = "success"
    NEEDS_REVIEW = "needs_review"
    NO_FORMULA = "no_formula"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ErrorClass(StrEnum):
    INVALID_INPUT = "invalid_input"
    UNSUPPORTED_FORMAT = "unsupported_format"
    FILE_TOO_LARGE = "file_too_large"
    PAGE_LIMIT = "page_limit"
    MODEL_UNAVAILABLE = "model_unavailable"
    MODEL_LOADING_FAILED = "model_loading_failed"
    QUEUE_FULL = "queue_full"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    DETECTION_FAILED = "detection_failed"
    INVALID_OUTPUT = "invalid_output"
    INTERNAL = "internal"


class RecognitionSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["image", "pdf", "docx", "markdown"]
    fileName: str | None = None
    pageNumber: int | None = Field(default=None, ge=1)
    regionId: str | None = None


class RecognitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requestId: str = Field(min_length=1, max_length=96, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    image: str = Field(min_length=1)
    mime: Literal["image/png", "image/jpeg", "image/webp"]
    formulaType: FormulaType
    mode: RecognitionMode
    source: RecognitionSource


class FormulaResult(BaseModel):
    latex: str
    uncertainties: list[str] = Field(default_factory=list)


class RecognitionResponse(BaseModel):
    requestId: str
    success: bool
    status: RecognitionStatus
    latex: str
    formulas: list[FormulaResult]
    formulaCount: int = Field(ge=0)
    uncertainties: list[str]
    confidence: float | None = Field(default=None, ge=0, le=1)
    engine: str
    provider: Literal["local"] = "local"
    processingTime: int = Field(ge=0)
    errorClass: ErrorClass | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    device: str
    models: dict[str, ModelState]


class CapabilityLimits(BaseModel):
    encodedImageBytes: int
    decodedPixels: int
    pdfBytes: int
    pdfPages: int
    queueCapacity: int


class EngineCapability(BaseModel):
    id: str
    kind: Literal["formula", "detection", "document"]
    available: bool
    state: ModelState
    license: Literal["verified", "unverified"]


class CapabilitiesResponse(BaseModel):
    supportedMimeTypes: list[str]
    limits: CapabilityLimits
    engines: list[EngineCapability]


class ErrorResponse(BaseModel):
    requestId: str
    errorClass: ErrorClass
    error: str
