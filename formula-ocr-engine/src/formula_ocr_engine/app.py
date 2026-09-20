from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from formula_ocr_engine.config import Settings
from formula_ocr_engine.contracts import (
    CapabilitiesResponse,
    CapabilityLimits,
    EngineCapability,
    ErrorClass,
    HealthResponse,
    ModelState,
    RecognitionRequest,
    RecognitionResponse,
    RecognitionStatus,
)


class ModelStatusProvider(Protocol):
    def statuses(self) -> Mapping[str, str]: ...


class UnavailableModelManager:
    def statuses(self) -> Mapping[str, str]:
        return {
            "formula": ModelState.NOT_LOADED,
            "detection": ModelState.NOT_LOADED,
            "document": ModelState.NOT_LOADED,
        }


def _model_states(model_manager: ModelStatusProvider) -> dict[str, ModelState]:
    raw = model_manager.statuses()
    return {
        "formula": ModelState(raw.get("formula", ModelState.NOT_LOADED)),
        "detection": ModelState(raw.get("detection", ModelState.NOT_LOADED)),
        "document": ModelState(raw.get("document", ModelState.NOT_LOADED)),
    }


def create_app(
    settings: Settings | None = None,
    *,
    model_manager: ModelStatusProvider | None = None,
) -> FastAPI:
    active_settings = settings or Settings.from_environment()
    active_models = model_manager or UnavailableModelManager()
    app = FastAPI(title="Formula OCR Engine", version=active_settings.version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(active_settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            version=active_settings.version,
            device=active_settings.device,
            models=_model_states(active_models),
        )

    @app.get("/v1/capabilities", response_model=CapabilitiesResponse)
    def capabilities() -> CapabilitiesResponse:
        states = _model_states(active_models)
        return CapabilitiesResponse(
            supportedMimeTypes=[
                "image/png",
                "image/jpeg",
                "image/webp",
                "application/pdf",
            ],
            limits=CapabilityLimits(
                encodedImageBytes=active_settings.encoded_image_bytes,
                decodedPixels=active_settings.decoded_pixels,
                pdfBytes=active_settings.pdf_bytes,
                pdfPages=active_settings.pdf_pages,
                queueCapacity=active_settings.queue_capacity,
            ),
            engines=[
                EngineCapability(
                    id="paddle-pp-formulanet-s",
                    kind="formula",
                    available=False,
                    state=states["formula"],
                    license="unverified",
                ),
                EngineCapability(
                    id="pix2text-mfd-1.5",
                    kind="detection",
                    available=False,
                    state=states["detection"],
                    license="unverified",
                ),
                EngineCapability(
                    id="pix2text-document-1.1.4",
                    kind="document",
                    available=False,
                    state=states["document"],
                    license="unverified",
                ),
            ],
        )

    @app.post("/v1/recognize", response_model=RecognitionResponse)
    def recognize(request: RecognitionRequest) -> JSONResponse:
        response = RecognitionResponse(
            requestId=request.requestId,
            success=False,
            status=RecognitionStatus.FAILED,
            latex="",
            formulas=[],
            formulaCount=0,
            uncertainties=[],
            confidence=None,
            engine="unavailable",
            processingTime=0,
            errorClass=ErrorClass.MODEL_UNAVAILABLE,
            error="Local formula model is not installed",
        )
        return JSONResponse(status_code=503, content=response.model_dump(mode="json"))

    return app


def main() -> None:
    settings = Settings.from_environment()
    uvicorn.run(create_app(settings), host=settings.bind_host, port=settings.port)


if __name__ == "__main__":
    main()
