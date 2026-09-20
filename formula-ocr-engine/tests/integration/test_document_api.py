from __future__ import annotations

import importlib
import threading
from pathlib import Path

import httpx
import pytest
from conftest import FakeModelManager


def load_document_stack():
    try:
        return (
            importlib.import_module("formula_ocr_engine.app"),
            importlib.import_module("formula_ocr_engine.config"),
            importlib.import_module("formula_ocr_engine.services.jobs"),
        )
    except ModuleNotFoundError as error:
        pytest.fail(f"document API is not implemented: {error}")


class ImmediateEngine:
    engine_id = "document-stub"

    def recognize_pdf(self, path: Path, cancel: threading.Event, progress):
        progress(1, 1)
        return {"markdown": "# Formula\n\n$E=mc^2$", "formulas": []}


@pytest.mark.asyncio
async def test_document_upload_returns_pollable_completed_job(tmp_path: Path) -> None:
    app_module, config_module, jobs_module = load_document_stack()
    jobs = jobs_module.DocumentJobManager(ImmediateEngine, temp_root=tmp_path)
    app = app_module.create_app(
        config_module.Settings(),
        model_manager=FakeModelManager(),
        document_jobs=jobs,
    )
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        submitted = await client.post(
            "/v1/jobs/documents",
            data={"requestId": "document-1"},
            files={"file": ("paper.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
        )
        job_id = submitted.json()["jobId"]
        jobs.wait(job_id, timeout=2)
        completed = await client.get(f"/v1/jobs/{job_id}")

    assert submitted.status_code == 202
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["markdown"] == "# Formula\n\n$E=mc^2$"
    jobs.shutdown()


@pytest.mark.asyncio
async def test_document_upload_rejects_non_pdf_magic(tmp_path: Path) -> None:
    app_module, config_module, jobs_module = load_document_stack()
    jobs = jobs_module.DocumentJobManager(ImmediateEngine, temp_root=tmp_path)
    app = app_module.create_app(config_module.Settings(), model_manager=FakeModelManager(), document_jobs=jobs)
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/jobs/documents",
            data={"requestId": "document-2"},
            files={"file": ("fake.pdf", b"not a pdf", "application/pdf")},
        )

    assert response.status_code == 400
    assert response.json()["errorClass"] == "unsupported_format"
    jobs.shutdown()


@pytest.mark.asyncio
async def test_document_upload_returns_queue_full_instead_of_500(tmp_path: Path) -> None:
    app_module, config_module, jobs_module = load_document_stack()

    class BlockingEngine:
        engine_id = "document-stub"

        def __init__(self) -> None:
            self.started = threading.Event()
            self.release = threading.Event()

        def recognize_pdf(self, path: Path, cancel: threading.Event, progress):
            self.started.set()
            self.release.wait(timeout=5)
            return {"markdown": "late", "formulas": []}

    engine = BlockingEngine()
    jobs = jobs_module.DocumentJobManager(lambda: engine, temp_root=tmp_path, capacity=1)
    app = app_module.create_app(config_module.Settings(), model_manager=FakeModelManager(), document_jobs=jobs)
    transport = httpx.ASGITransport(app=app)
    files = {"file": ("paper.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")}

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        first = await client.post("/v1/jobs/documents", data={"requestId": "document-1"}, files=files)
        assert engine.started.wait(timeout=2)
        second = await client.post("/v1/jobs/documents", data={"requestId": "document-2"}, files=files)

    assert second.status_code == 429
    assert second.json()["errorClass"] == "queue_full"
    jobs.cancel(first.json()["jobId"])
    engine.release.set()
    jobs.wait(first.json()["jobId"], timeout=2)
    jobs.shutdown()
