from __future__ import annotations

import tempfile
import threading
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Protocol

from formula_ocr_engine.contracts import ErrorClass
from formula_ocr_engine.errors import EngineError

JobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class DocumentEngine(Protocol):
    engine_id: str

    def recognize_pdf(
        self,
        path: Path,
        cancel: threading.Event,
        progress: Callable[[int, int], None],
    ) -> dict[str, object]: ...


@dataclass
class DocumentJob:
    jobId: str
    requestId: str
    fileName: str
    status: JobStatus = "queued"
    page: int = 0
    totalPages: int = 0
    markdown: str | None = None
    formulas: list[dict[str, object]] = field(default_factory=list)
    errorClass: str | None = None
    error: str | None = None


class DocumentJobManager:
    def __init__(
        self,
        engine_factory: Callable[[], DocumentEngine],
        *,
        temp_root: Path | None = None,
        capacity: int = 8,
    ) -> None:
        if capacity < 1:
            raise ValueError("capacity must be positive")
        self._engine_factory = engine_factory
        self._temp_root = temp_root
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="formula-doc")
        self._jobs: dict[str, DocumentJob] = {}
        self._cancellations: dict[str, threading.Event] = {}
        self._done: dict[str, threading.Event] = {}
        self._condition = threading.Condition()
        self._capacity = capacity

    def submit(self, data: bytes, file_name: str, request_id: str) -> str:
        job_id = f"doc-{uuid.uuid4()}"
        cancel = threading.Event()
        job = DocumentJob(jobId=job_id, requestId=request_id, fileName=file_name)
        with self._condition:
            active = sum(job.status in {"queued", "running"} for job in self._jobs.values())
            if active >= self._capacity:
                raise EngineError(ErrorClass.QUEUE_FULL, "local document queue is full")
        with tempfile.NamedTemporaryFile(
            suffix=".pdf",
            dir=self._temp_root,
            delete=False,
        ) as handle:
            handle.write(data)
            path = Path(handle.name)
        with self._condition:
            self._jobs[job_id] = job
            self._cancellations[job_id] = cancel
            self._done[job_id] = threading.Event()
        self._executor.submit(self._run, job_id, path, cancel)
        return job_id

    def _run(self, job_id: str, path: Path, cancel: threading.Event) -> None:
        try:
            with self._condition:
                job = self._jobs[job_id]
                if cancel.is_set():
                    job.status = "cancelled"
                    self._condition.notify_all()
                    return
                job.status = "running"
                self._condition.notify_all()

            def progress(page: int, total: int) -> None:
                with self._condition:
                    job = self._jobs[job_id]
                    if not cancel.is_set():
                        job.page = page
                        job.totalPages = total
                    self._condition.notify_all()

            result = self._engine_factory().recognize_pdf(path, cancel, progress)
            with self._condition:
                job = self._jobs[job_id]
                if cancel.is_set():
                    job.status = "cancelled"
                    job.markdown = None
                    job.formulas = []
                else:
                    job.status = "completed"
                    markdown = result.get("markdown")
                    job.markdown = markdown if isinstance(markdown, str) else ""
                    formulas = result.get("formulas")
                    job.formulas = formulas if isinstance(formulas, list) else []
                self._condition.notify_all()
        except Exception as error:  # noqa: BLE001 - isolate each document job failure
            with self._condition:
                job = self._jobs[job_id]
                if cancel.is_set():
                    job.status = "cancelled"
                else:
                    job.status = "failed"
                    job.errorClass = "internal"
                    job.error = str(error)
                self._condition.notify_all()
        finally:
            path.unlink(missing_ok=True)
            self._done[job_id].set()

    def get(self, job_id: str) -> DocumentJob:
        with self._condition:
            if job_id not in self._jobs:
                raise KeyError(job_id)
            return DocumentJob(**vars(self._jobs[job_id]))

    def cancel(self, job_id: str) -> DocumentJob:
        with self._condition:
            job = self._jobs[job_id]
            self._cancellations[job_id].set()
            job.status = "cancelled"
            job.markdown = None
            job.formulas = []
            self._condition.notify_all()
            return DocumentJob(**vars(job))

    def wait(self, job_id: str, timeout: float) -> DocumentJob:
        self._done[job_id].wait(timeout=timeout)
        with self._condition:
            return DocumentJob(**vars(self._jobs[job_id]))

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)
