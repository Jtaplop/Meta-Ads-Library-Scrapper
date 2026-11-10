"""
jobs.py — Job storage, FIFO execution queue, pause countdown, SSE pub/sub, and job lifecycle.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger

from api.command import build_command
from api.log_parser import LogParser, compute_final_status, update_job_with_parse_result
from api.runner import SubprocessRunner
from api.schemas import (
    Batch,
    BatchDetailResponse,
    BatchRequest,
    Job,
    JobPhase,
    JobProgress,
    JobStatus,
    LogEntry,
    ScrapeRequest,
)
from api.settings import (
    BACKEND_DIR,
    DATA_DIR,
    JOB_PAUSE_SECONDS,
    MAX_LOG_LINES_IN_MEMORY,
)


def format_sse(event_type: str, data: Any, event_id: int | str | None = None) -> str:
    """Formats payload as a valid Server-Sent Events (SSE) message."""
    if hasattr(data, "model_dump_json"):
        payload = data.model_dump_json()
    elif isinstance(data, (dict, list)):
        payload = json.dumps(data, ensure_ascii=False)
    else:
        payload = str(data)

    lines = [f"event: {event_type}"]
    if event_id is not None:
        lines.append(f"id: {event_id}")
    lines.append(f"data: {payload}\n\n")
    return "\n".join(lines)


# ============================================================================
# Job Storage (JSON persistence + per-job log files)
# ============================================================================

class JobStore:
    """
    Manages atomic persistence of jobs and batches to JSON, in-memory ring buffers
    for fast log replay, and disk logs in DATA_DIR / 'logs' / '<job_id>.log'.
    Retains the 200 most recent jobs and cleans up orphan logs.
    """

    MAX_RETAINED_JOBS = 200

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir: Path = (data_dir or DATA_DIR).resolve()
        self.jobs_file: Path = self.data_dir / "jobs.json"
        self.batches_file: Path = self.data_dir / "batches.json"
        self.logs_dir: Path = self.data_dir / "logs"

        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        self._jobs: dict[str, Job] = {}
        self._batches: dict[str, Batch] = {}
        self._log_buffers: dict[str, deque[LogEntry]] = {}

        self.load()

    def load(self) -> None:
        """Loads jobs and batches from disk and handles unclean shutdown transitions."""
        if self.jobs_file.exists():
            try:
                with open(self.jobs_file, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    for item in raw_data:
                        try:
                            job = Job.model_validate(item)
                            # On startup, mark any unfinished jobs as failed due to restart
                            if job.status in (JobStatus.running, JobStatus.waiting):
                                job.status = JobStatus.failed
                                job.error = "API reiniciada durante la ejecución"
                                job.finished_at = datetime.now()
                            self._jobs[job.id] = job
                        except Exception as e:
                            logger.error(f"Failed to validate stored job: {e}")
            except Exception as exc:
                logger.error(f"Error loading {self.jobs_file}: {exc}")

        if self.batches_file.exists():
            try:
                with open(self.batches_file, "r", encoding="utf-8") as f:
                    raw_batches = json.load(f)
                    for item in raw_batches:
                        try:
                            batch = Batch.model_validate(item)
                            self._batches[batch.id] = batch
                        except Exception as e:
                            logger.error(f"Failed to validate stored batch: {e}")
            except Exception as exc:
                logger.error(f"Error loading {self.batches_file}: {exc}")

        # Save any updated statuses from unclean shutdown
        self.save_jobs()

    def save_jobs(self) -> None:
        """Atomically saves jobs to DATA_DIR/jobs.json with retention pruning."""
        # Retention: Keep latest MAX_RETAINED_JOBS sorted by created_at desc
        sorted_jobs = sorted(
            self._jobs.values(), key=lambda j: j.created_at, reverse=True
        )

        if len(sorted_jobs) > self.MAX_RETAINED_JOBS:
            keep = sorted_jobs[: self.MAX_RETAINED_JOBS]
            prune = sorted_jobs[self.MAX_RETAINED_JOBS :]
            self._jobs = {j.id: j for j in keep}
            for j in prune:
                self._log_buffers.pop(j.id, None)
                log_path = self.logs_dir / f"{j.id}.log"
                if log_path.exists():
                    try:
                        log_path.unlink()
                    except Exception:
                        pass
            sorted_jobs = keep

        tmp_file = self.data_dir / "jobs.json.tmp"
        try:
            data = [j.model_dump(mode="json") for j in sorted_jobs]
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_file, self.jobs_file)
        except Exception as exc:
            logger.error(f"Failed to atomically write {self.jobs_file}: {exc}")
            if tmp_file.exists():
                try:
                    tmp_file.unlink()
                except Exception:
                    pass

    def save_batches(self) -> None:
        """Atomically saves batches to DATA_DIR/batches.json."""
        tmp_file = self.data_dir / "batches.json.tmp"
        try:
            data = [b.model_dump(mode="json") for b in self._batches.values()]
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_file, self.batches_file)
        except Exception as exc:
            logger.error(f"Failed to atomically write {self.batches_file}: {exc}")
            if tmp_file.exists():
                try:
                    tmp_file.unlink()
                except Exception:
                    pass

    def add_job(self, job: Job) -> None:
        self._jobs[job.id] = job
        self.save_jobs()

    def get_job(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def list_jobs(
        self,
        status: JobStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Job], int]:
        all_jobs = sorted(
            self._jobs.values(), key=lambda j: j.created_at, reverse=True
        )
        if status is not None:
            all_jobs = [j for j in all_jobs if j.status == status]
        total = len(all_jobs)
        items = all_jobs[offset : offset + limit]
        return items, total

    def delete_job(self, job_id: str) -> bool:
        if job_id not in self._jobs:
            return False
        job = self._jobs[job_id]
        if job.status in (JobStatus.running, JobStatus.waiting):
            raise ValueError(f"Cannot delete active job {job_id}")

        del self._jobs[job_id]
        self._log_buffers.pop(job_id, None)

        log_path = self.logs_dir / f"{job_id}.log"
        if log_path.exists():
            try:
                log_path.unlink()
            except Exception:
                pass

        self.save_jobs()
        return True

    def add_batch(self, batch: Batch) -> None:
        self._batches[batch.id] = batch
        self.save_batches()

    def get_batch(self, batch_id: str) -> Batch | None:
        return self._batches.get(batch_id)

    def append_log(self, job_id: str, entry: LogEntry, raw_line: str) -> None:
        """Appends log entry to in-memory circular buffer and appends clean raw to disk."""
        if job_id not in self._log_buffers:
            self._log_buffers[job_id] = deque(maxlen=MAX_LOG_LINES_IN_MEMORY)
        self._log_buffers[job_id].append(entry)

        log_path = self.logs_dir / f"{job_id}.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(entry.raw + "\n")
        except Exception as exc:
            logger.error(f"Error appending to log file {log_path}: {exc}")

    def get_log_entries(self, job_id: str) -> list[LogEntry]:
        """Returns log entries from buffer or disk."""
        if job_id in self._log_buffers and self._log_buffers[job_id]:
            return list(self._log_buffers[job_id])

        log_path = self.logs_dir / f"{job_id}.log"
        if not log_path.exists():
            return []

        entries: list[LogEntry] = []
        parser = LogParser()
        try:
            with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    res = parser.parse_line(line)
                    entries.append(res.log_entry)
        except Exception as exc:
            logger.error(f"Error reading log file {log_path}: {exc}")

        return entries

    def get_log_text(self, job_id: str) -> str:
        """Returns the full plain-text log from disk."""
        log_path = self.logs_dir / f"{job_id}.log"
        if not log_path.exists():
            return ""
        try:
            with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except Exception as exc:
            logger.error(f"Error reading log text for {job_id}: {exc}")
            return ""


# ============================================================================
# JobManager (Worker, Queue, Pause & Pub/Sub)
# ============================================================================

class JobManager:
    """
    Coordinates sequential execution of jobs in a FIFO queue.
    Handles anti-blocking pause countdown, SSE event subscriptions, and cancellation.
    """

    def __init__(self, job_store: JobStore | None = None) -> None:
        self.job_store: JobStore = job_store or JobStore()
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self._loop: asyncio.AbstractEventLoop | None = None
        self.active_job_id: str | None = None
        self.current_runner: SubprocessRunner | None = None
        self.last_job_finished_at: datetime | None = None

        self._subscribers: dict[str, set[asyncio.Queue[str]]] = {}
        self._global_subscribers: set[asyncio.Queue[str]] = set()

        self._worker_task: asyncio.Task | None = None
        self._cancel_waiting_event: asyncio.Event | None = None

    def start(self) -> None:
        """Starts the sequential worker loop task."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop is not None and getattr(self, "_loop", None) != loop:
            self._loop = loop
            old_items = []
            if hasattr(self, "queue") and self.queue is not None:
                while not self.queue.empty():
                    try:
                        old_items.append(self.queue.get_nowait())
                    except Exception:
                        break
            self.queue = asyncio.Queue()
            for item in old_items:
                self.queue.put_nowait(item)
            self._subscribers.clear()
            self._global_subscribers.clear()
            self._worker_task = None

        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        """Gracefully shuts down worker task and cancels running job."""
        if self.current_runner and self.active_job_id:
            try:
                self.cancel_job(self.active_job_id)
            except Exception:
                pass

        if self._cancel_waiting_event:
            self._cancel_waiting_event.set()

        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except (asyncio.CancelledError, RuntimeError):
                pass
            self._worker_task = None

    # -----------------------------------------------------------------------
    # Pub/Sub SSE
    # -----------------------------------------------------------------------
    def subscribe(self, job_id: str) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue()
        if job_id not in self._subscribers:
            self._subscribers[job_id] = set()
        self._subscribers[job_id].add(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue[str]) -> None:
        if job_id in self._subscribers:
            self._subscribers[job_id].discard(q)
            if not self._subscribers[job_id]:
                del self._subscribers[job_id]

    def subscribe_global(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue()
        self._global_subscribers.add(q)
        return q

    def unsubscribe_global(self, q: asyncio.Queue[str]) -> None:
        self._global_subscribers.discard(q)

    def broadcast_event(
        self,
        job_id: str,
        event_type: str,
        data: Any,
        event_id: int | str | None = None,
    ) -> None:
        """Broadcasts SSE string to job subscribers and global subscribers."""
        msg = format_sse(event_type, data, event_id)

        # Notify job-specific subscribers
        if job_id in self._subscribers:
            for q in list(self._subscribers[job_id]):
                try:
                    q.put_nowait(msg)
                except Exception:
                    pass

        # Notify global listeners on significant status / progress / done events
        if event_type in ("status", "progress", "done"):
            job = self.job_store.get_job(job_id)
            global_payload = {
                "event": event_type,
                "job_id": job_id,
                "job": job.model_dump(mode="json") if job else None,
            }
            global_msg = format_sse("job_update", global_payload, event_id)
            for gq in list(self._global_subscribers):
                try:
                    gq.put_nowait(global_msg)
                except Exception:
                    pass

    # -----------------------------------------------------------------------
    # Queue Management
    # -----------------------------------------------------------------------
    def enqueue_job(
        self,
        req: ScrapeRequest,
        batch_id: str | None = None,
        pause_before: int = 0,
    ) -> Job:
        """Creates a Job instance, saves it to store, and queues it for execution."""
        job_id = uuid.uuid4().hex[:8]
        cmd = build_command(req)

        job = Job(
            id=job_id,
            batch_id=batch_id,
            request=req,
            command=cmd,
            status=JobStatus.queued,
            phase=None,
            progress=JobProgress(limit=req.limit),
            created_at=datetime.now(),
            pause_before=pause_before,
        )

        self.job_store.add_job(job)
        self.queue.put_nowait(job.id)

        # Ensure worker task is running
        self.start()

        return job

    def enqueue_batch(self, req: BatchRequest) -> Batch:
        """Creates a Batch, enqueues all its queries sequentially, and stores it."""
        batch_id = uuid.uuid4().hex[:8]
        job_ids: list[str] = []

        for idx, query in enumerate(req.queries):
            sub_req = req.base.model_copy(update={"query": query})
            # First job starts without batch pause; subsequent jobs wait pause_seconds
            pause = 0 if idx == 0 else req.pause_seconds
            job = self.enqueue_job(
                req=sub_req,
                batch_id=batch_id,
                pause_before=pause,
            )
            job_ids.append(job.id)

        batch = Batch(
            id=batch_id,
            queries=req.queries,
            base=req.base,
            pause_seconds=req.pause_seconds,
            job_ids=job_ids,
            created_at=datetime.now(),
        )

        self.job_store.add_batch(batch)
        return batch

    def cancel_job(self, job_id: str) -> Job:
        """Cancels a job according to its current state (queued, waiting, running)."""
        job = self.job_store.get_job(job_id)
        if not job:
            raise ValueError(f"Job not found: {job_id}")

        if job.status in (
            JobStatus.succeeded,
            JobStatus.empty,
            JobStatus.failed,
            JobStatus.cancelled,
        ):
            return job

        if job.status == JobStatus.queued:
            job.status = JobStatus.cancelled
            job.finished_at = datetime.now()
            self.job_store.save_jobs()
            self.broadcast_event(job.id, "done", job)
            return job

        if job.status == JobStatus.waiting:
            job.status = JobStatus.cancelled
            job.finished_at = datetime.now()
            if self._cancel_waiting_event:
                self._cancel_waiting_event.set()
            self.job_store.save_jobs()
            self.broadcast_event(job.id, "done", job)
            return job

        if job.status == JobStatus.running:
            job.status = JobStatus.cancelled
            if self.current_runner and self.active_job_id == job_id:
                self.current_runner.cancel()
            return job

        return job

    def cancel_batch(self, batch_id: str) -> Batch:
        """Cancels all pending and running jobs for a batch."""
        batch = self.job_store.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch not found: {batch_id}")

        for job_id in batch.job_ids:
            try:
                self.cancel_job(job_id)
            except Exception as e:
                logger.debug(f"Could not cancel job {job_id} in batch {batch_id}: {e}")

        return batch

    def retry_job(self, job_id: str) -> Job:
        """Creates and enqueues a new Job with the same request parameters."""
        old_job = self.job_store.get_job(job_id)
        if not old_job:
            raise ValueError(f"Job not found: {job_id}")

        return self.enqueue_job(req=old_job.request)

    def get_batch_detail(self, batch_id: str) -> BatchDetailResponse | None:
        """Builds aggregated batch response with progress counters across all jobs."""
        batch = self.job_store.get_batch(batch_id)
        if not batch:
            return None

        jobs: list[Job] = []
        for jid in batch.job_ids:
            j = self.job_store.get_job(jid)
            if j:
                jobs.append(j)

        total_jobs = len(jobs)
        completed_jobs = sum(
            1
            for j in jobs
            if j.status
            in (
                JobStatus.succeeded,
                JobStatus.empty,
                JobStatus.failed,
                JobStatus.cancelled,
            )
        )
        total_collected = sum(j.progress.collected for j in jobs)
        total_limit = sum(j.progress.limit for j in jobs)

        # Compute aggregate status
        if any(j.status == JobStatus.running for j in jobs):
            status = "running"
        elif any(j.status == JobStatus.waiting for j in jobs):
            status = "waiting"
        elif all(
            j.status in (JobStatus.succeeded, JobStatus.empty) for j in jobs
        ) and total_jobs > 0:
            status = "succeeded"
        elif all(
            j.status in (JobStatus.cancelled, JobStatus.failed) for j in jobs
        ) and total_jobs > 0:
            status = "cancelled" if any(j.status == JobStatus.cancelled for j in jobs) else "failed"
        elif any(j.status == JobStatus.queued for j in jobs):
            status = "queued"
        else:
            status = "completed"

        return BatchDetailResponse(
            id=batch.id,
            queries=batch.queries,
            pause_seconds=batch.pause_seconds,
            created_at=batch.created_at,
            jobs=jobs,
            status=status,
            total_jobs=total_jobs,
            completed_jobs=completed_jobs,
            total_collected=total_collected,
            total_limit=total_limit,
        )

    # -----------------------------------------------------------------------
    # Worker Loop
    # -----------------------------------------------------------------------
    async def _worker_loop(self) -> None:
        while True:
            try:
                job_id = await self.queue.get()
            except asyncio.CancelledError:
                break

            try:
                await self._process_job(job_id)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.exception(f"Unexpected worker loop exception: {exc}")
            finally:
                self.queue.task_done()

    async def _process_job(self, job_id: str) -> None:
        job = self.job_store.get_job(job_id)
        if not job or job.status == JobStatus.cancelled:
            return

        # ------------------------------------------------------------------
        # 1. Anti-blocking pause check
        # ------------------------------------------------------------------
        effective_pause = job.pause_before
        if effective_pause == 0 and self.last_job_finished_at is not None:
            # Standalone job queued after a previous job ran: check if recent
            elapsed = (datetime.now() - self.last_job_finished_at).total_seconds()
            if elapsed < JOB_PAUSE_SECONDS and job.batch_id is None:
                # If desired, apply pause; prompt notes: allow skipping if pause_seconds == 0
                pass

        if self.last_job_finished_at is not None and effective_pause > 0:
            elapsed = (datetime.now() - self.last_job_finished_at).total_seconds()
            remaining = int(effective_pause - elapsed)
            if remaining > 0:
                job.status = JobStatus.waiting
                self.active_job_id = job.id
                self.job_store.save_jobs()
                self.broadcast_event(
                    job.id, "status", {"status": job.status, "phase": job.phase}
                )

                self._cancel_waiting_event = asyncio.Event()
                while remaining > 0:
                    if (
                        self._cancel_waiting_event.is_set()
                        or job.status == JobStatus.cancelled
                    ):
                        break
                    job.progress.wait_remaining_seconds = remaining
                    self.broadcast_event(job.id, "progress", job.progress)

                    try:
                        await asyncio.wait_for(
                            self._cancel_waiting_event.wait(), timeout=1.0
                        )
                    except asyncio.TimeoutError:
                        remaining -= 1

                job.progress.wait_remaining_seconds = None
                self._cancel_waiting_event = None

                if job.status == JobStatus.cancelled:
                    self.active_job_id = None
                    self.broadcast_event(job.id, "done", job)
                    return

        # ------------------------------------------------------------------
        # 2. Launch Subprocess
        # ------------------------------------------------------------------
        job.status = JobStatus.running
        job.started_at = datetime.now()
        job.phase = JobPhase.starting
        self.active_job_id = job.id
        self.job_store.save_jobs()

        self.broadcast_event(
            job.id,
            "status",
            {
                "status": job.status,
                "phase": job.phase,
                "started_at": job.started_at.isoformat(),
            },
        )

        runner = SubprocessRunner(cmd=job.command, cwd=BACKEND_DIR)
        self.current_runner = runner
        loop = asyncio.get_running_loop()

        try:
            pid = runner.start(loop)
            job.pid = pid
            self.job_store.save_jobs()
        except Exception as exc:
            logger.error(f"Failed to start subprocess for job {job.id}: {exc}")
            job.status = JobStatus.failed
            job.error = f"No se pudo iniciar el subproceso: {exc}"
            job.finished_at = datetime.now()
            self.last_job_finished_at = job.finished_at
            self.job_store.save_jobs()
            self.broadcast_event(job.id, "done", job)
            self.current_runner = None
            self.active_job_id = None
            return

        parser = LogParser()
        empty_matched = False
        last_stderr_lines: deque[str] = deque(maxlen=20)

        async for stream_name, raw_line in runner.stream_lines():
            parse_result = parser.parse_line(raw_line)
            self.job_store.append_log(job.id, parse_result.log_entry, raw_line)

            if stream_name == "stderr":
                clean_stderr = parse_result.log_entry.message
                if clean_stderr:
                    last_stderr_lines.append(clean_stderr)

            if parse_result.empty_matched:
                empty_matched = True

            phase_changed, progress_changed = update_job_with_parse_result(
                job, parse_result
            )

            # Emit log event
            self.broadcast_event(
                job.id,
                "log",
                parse_result.log_entry,
                event_id=parse_result.log_entry.seq,
            )

            # Emit warning event if present
            if parse_result.warning:
                self.broadcast_event(job.id, "warning", parse_result.warning)

            # Emit progress update if counters changed
            if progress_changed:
                self.broadcast_event(job.id, "progress", job.progress)

            # Emit status update if phase changed
            if phase_changed:
                self.job_store.save_jobs()
                self.broadcast_event(
                    job.id,
                    "status",
                    {"status": job.status, "phase": job.phase},
                )

        # ------------------------------------------------------------------
        # 3. Finalize process execution
        # ------------------------------------------------------------------
        exit_code = await runner.wait()
        job.exit_code = exit_code
        job.finished_at = datetime.now()
        self.last_job_finished_at = job.finished_at

        final_status = compute_final_status(
            cancelled=runner.is_cancelled or job.status == JobStatus.cancelled,
            exit_code=exit_code,
            result_file=job.result_file,
            empty_matched=empty_matched,
        )

        job.status = final_status
        job.phase = JobPhase.finished

        if final_status == JobStatus.failed and not job.error:
            if last_stderr_lines:
                job.error = "\n".join(last_stderr_lines)
            else:
                job.error = f"Subproceso finalizó con código de error {exit_code}"

        self.job_store.save_jobs()
        self.broadcast_event(job.id, "done", job)

        self.current_runner = None
        self.active_job_id = None

    async def shutdown(self) -> None:
        """Alias for stop() with queued jobs cleanup for graceful app shutdown."""
        if self.current_runner and self.active_job_id:
            try:
                self.cancel_job(self.active_job_id)
            except Exception:
                pass

        for job in list(self.job_store._jobs.values()):
            if job.status in (JobStatus.queued, JobStatus.waiting):
                job.status = JobStatus.cancelled
                job.finished_at = datetime.now()
        self.job_store.save_jobs()

        await self.stop()


# Default singleton instance for the application
job_manager = JobManager()

