from __future__ import annotations

import importlib
import threading
from pathlib import Path

import pytest

from formula_ocr_engine.contracts import ErrorClass
from formula_ocr_engine.errors import EngineError


def load_jobs():
    try:
        return importlib.import_module("formula_ocr_engine.services.jobs")
    except ModuleNotFoundError as error:
        pytest.fail(f"document job manager is not implemented: {error}")


class BlockingEngine:
    engine_id = "document-stub"

    def __init__(self) -> None:
        self.started = threading.Event()
        self.release = threading.Event()

    def recognize_pdf(self, path: Path, cancel: threading.Event, progress):
        self.started.set()
        self.release.wait(timeout=5)
        progress(1, 1)
        return {"markdown": "# late result", "formulas": []}


def test_cancelled_document_never_publishes_late_result(tmp_path: Path) -> None:
    jobs = load_jobs()
    engine = BlockingEngine()
    manager = jobs.DocumentJobManager(lambda: engine, temp_root=tmp_path)
    job_id = manager.submit(b"%PDF-1.4\n%%EOF", "paper.pdf", "request-1")
    assert engine.started.wait(timeout=2)

    manager.cancel(job_id)
    engine.release.set()
    terminal = manager.wait(job_id, timeout=2)

    assert terminal.status == "cancelled"
    assert terminal.markdown is None
    assert list(tmp_path.iterdir()) == []
    manager.shutdown()


class FailingEngine:
    engine_id = "document-stub"

    def recognize_pdf(self, path: Path, cancel: threading.Event, progress):
        raise RuntimeError("document engine failed")


def test_temporary_pdf_is_removed_after_engine_failure(tmp_path: Path) -> None:
    jobs = load_jobs()
    manager = jobs.DocumentJobManager(FailingEngine, temp_root=tmp_path)
    job_id = manager.submit(b"%PDF-1.4\n%%EOF", "broken.pdf", "request-2")

    terminal = manager.wait(job_id, timeout=2)

    assert terminal.status == "failed"
    assert terminal.errorClass == "internal"
    assert list(tmp_path.iterdir()) == []
    manager.shutdown()


def test_document_queue_rejects_work_beyond_capacity_without_temp_file(tmp_path: Path) -> None:
    jobs = load_jobs()
    engine = BlockingEngine()
    manager = jobs.DocumentJobManager(lambda: engine, temp_root=tmp_path, capacity=1)
    first = manager.submit(b"%PDF-1.4\n%%EOF", "first.pdf", "request-1")
    assert engine.started.wait(timeout=2)

    with pytest.raises(EngineError) as captured:
        manager.submit(b"%PDF-1.4\n%%EOF", "second.pdf", "request-2")

    assert captured.value.error_class == ErrorClass.QUEUE_FULL
    assert len(list(tmp_path.iterdir())) == 1
    manager.cancel(first)
    engine.release.set()
    manager.wait(first, timeout=2)
    manager.shutdown()
