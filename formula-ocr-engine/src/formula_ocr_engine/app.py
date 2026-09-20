from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol

import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from formula_ocr_engine.config import Settings
from formula_ocr_engine.contracts import (
    CapabilitiesResponse,
    CapabilityLimits,
    DetectionRequest,
    DetectionResponse,
    EngineCapability,
    ErrorClass,
    HealthResponse,
    ModelState,
    RecognitionRequest,
    RecognitionResponse,
    RecognitionStatus,
)
from formula_ocr_engine.engines.base import DetectionEngine, FormulaEngine
from formula_ocr_engine.engines.paddle_formula import create_paddle_formula_engine
from formula_ocr_engine.engines.pix2text_detection import create_pix2text_detection_engine
from formula_ocr_engine.errors import EngineError
from formula_ocr_engine.image_input import ImageLimits
from formula_ocr_engine.model_manager import ModelManager
from formula_ocr_engine.services.detection import DetectionService
from formula_ocr_engine.services.jobs import DocumentJobManager
from formula_ocr_engine.services.recognition import RecognitionService


class ModelStatusProvider(Protocol):
    def statuses(self) -> Mapping[str, str]: ...

    def formula_available(self) -> bool: ...

    def detection_available(self) -> bool: ...

    def formula(self) -> FormulaEngine: ...

    def detection(self) -> DetectionEngine: ...


class UnavailableModelManager:
    def statuses(self) -> Mapping[str, str]:
        return {
            "formula": ModelState.NOT_LOADED,
            "detection": ModelState.NOT_LOADED,
            "document": ModelState.NOT_LOADED,
        }

    def formula(self) -> FormulaEngine:
        raise EngineError(ErrorClass.MODEL_UNAVAILABLE, "local formula model is unavailable")

    def formula_available(self) -> bool:
        return False

    def detection_available(self) -> bool:
        return False

    def detection(self) -> DetectionEngine:
        raise EngineError(ErrorClass.MODEL_UNAVAILABLE, "local detection model is unavailable")


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
    document_jobs: DocumentJobManager | None = None,
) -> FastAPI:
    active_settings = settings or Settings.from_environment()
    active_models = model_manager or ModelManager(
        formula_factory=create_paddle_formula_engine,
        detection_factory=create_pix2text_detection_engine,
    )
    recognition_service = RecognitionService(
        active_models,
        ImageLimits(
            encoded_bytes=active_settings.encoded_image_bytes,
            decoded_pixels=active_settings.decoded_pixels,
        ),
    )
    detection_service = DetectionService(
        active_models,
        ImageLimits(
            encoded_bytes=active_settings.encoded_image_bytes,
            decoded_pixels=active_settings.decoded_pixels,
        ),
    )
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
                    available=active_models.formula_available(),
                    state=states["formula"],
                    license="verified",
                ),
                EngineCapability(
                    id="pix2text-mfd-1.5",
                    kind="detection",
                    available=active_models.detection_available(),
                    state=states["detection"],
                    license="verified",
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
        try:
            response = recognition_service.recognize(request)
            return JSONResponse(status_code=200, content=response.model_dump(mode="json"))
        except EngineError as error:
            status_code = 503 if error.error_class in {
                ErrorClass.MODEL_UNAVAILABLE,
                ErrorClass.MODEL_LOADING_FAILED,
            } else 400
            response = RecognitionResponse(
                requestId=request.requestId,
                success=False,
                status=(
                    RecognitionStatus.CANCELLED
                    if error.error_class == ErrorClass.CANCELLED
                    else RecognitionStatus.FAILED
                ),
                latex="",
                formulas=[],
                formulaCount=0,
                uncertainties=[],
                engine="unavailable",
                processingTime=0,
                errorClass=error.error_class,
                error=error.message,
            )
            return JSONResponse(status_code=status_code, content=response.model_dump(mode="json"))

    @app.post("/v1/detect", response_model=DetectionResponse)
    def detect(request: DetectionRequest) -> JSONResponse:
        try:
            response = detection_service.detect(request)
            return JSONResponse(status_code=200, content=response.model_dump(mode="json"))
        except EngineError as error:
            status_code = 503 if error.error_class in {
                ErrorClass.MODEL_UNAVAILABLE,
                ErrorClass.MODEL_LOADING_FAILED,
            } else 400
            return JSONResponse(
                status_code=status_code,
                content={
                    "requestId": request.requestId,
                    "status": "failed",
                    "engine": "unavailable",
                    "processingTime": 0,
                    "regions": [],
                    "errorClass": error.error_class.value,
                    "error": error.message,
                },
            )

    @app.post("/v1/jobs/documents")
    async def submit_document(
        requestId: str = Form(...),
        file: UploadFile = File(...),  # noqa: B008 - FastAPI declaration
    ) -> JSONResponse:
        if document_jobs is None:
            return JSONResponse(
                status_code=503,
                content={"requestId": requestId, "errorClass": "model_unavailable", "error": "Local document engine is unavailable"},
            )
        if file.content_type != "application/pdf":
            return JSONResponse(
                status_code=400,
                content={"requestId": requestId, "errorClass": "unsupported_format", "error": "Only PDF uploads are accepted"},
            )
        data = await file.read(active_settings.pdf_bytes + 1)
        if len(data) > active_settings.pdf_bytes:
            return JSONResponse(
                status_code=413,
                content={"requestId": requestId, "errorClass": "file_too_large", "error": "PDF exceeds the byte limit"},
            )
        if not data.startswith(b"%PDF-"):
            return JSONResponse(
                status_code=400,
                content={"requestId": requestId, "errorClass": "unsupported_format", "error": "PDF magic bytes are invalid"},
            )
        try:
            job_id = document_jobs.submit(data, file.filename or "document.pdf", requestId)
        except EngineError as error:
            status_code = 429 if error.error_class == ErrorClass.QUEUE_FULL else 400
            return JSONResponse(
                status_code=status_code,
                content={"requestId": requestId, "errorClass": error.error_class.value, "error": error.message},
            )
        return JSONResponse(status_code=202, content={"requestId": requestId, "jobId": job_id, "status": "queued"})

    @app.get("/v1/jobs/{job_id}")
    def get_document_job(job_id: str) -> JSONResponse:
        if document_jobs is None:
            return JSONResponse(status_code=503, content={"errorClass": "model_unavailable", "error": "Local document engine is unavailable"})
        try:
            job = document_jobs.get(job_id)
        except KeyError:
            return JSONResponse(status_code=404, content={"errorClass": "invalid_input", "error": "Document job was not found"})
        return JSONResponse(status_code=200, content=vars(job))

    @app.delete("/v1/jobs/{job_id}")
    def cancel_document_job(job_id: str) -> JSONResponse:
        if document_jobs is None:
            return JSONResponse(status_code=503, content={"errorClass": "model_unavailable", "error": "Local document engine is unavailable"})
        try:
            job = document_jobs.cancel(job_id)
        except KeyError:
            return JSONResponse(status_code=404, content={"errorClass": "invalid_input", "error": "Document job was not found"})
        return JSONResponse(status_code=200, content=vars(job))

    return app


def main() -> None:
    settings = Settings.from_environment()
    uvicorn.run(create_app(settings), host=settings.bind_host, port=settings.port)


if __name__ == "__main__":
    main()
