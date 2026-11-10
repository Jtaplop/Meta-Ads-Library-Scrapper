"""
jobs.py — Jobs management router: creation, listing, cancellation, retry, deletion, logs, and SSE streams.
"""

from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import PlainTextResponse, StreamingResponse

from api.jobs import format_sse, job_manager
from api.schemas import (
    Job,
    JobsListResponse,
    JobStatus,
    LogEntry,
    ScrapeRequest,
)

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("", response_model=Job, status_code=201)
def create_job(req: ScrapeRequest) -> Job:
    """Enqueues a new scraping job. If queue is empty, execution starts immediately."""
    return job_manager.enqueue_job(req)


@router.get("", response_model=JobsListResponse)
def list_jobs(
    status: JobStatus | None = Query(None, description="Filter by job status"),
    limit: int = Query(50, ge=1, le=500, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> JobsListResponse:
    """Lists persisted jobs sorted by created_at descending."""
    items, total = job_manager.job_store.list_jobs(status=status, limit=limit, offset=offset)
    return JobsListResponse(items=items, total=total)


@router.get("/events")
async def stream_global_job_events():
    """
    Global Server-Sent Events stream emitting state changes for any job.
    Includes a 15-second heartbeat ping.
    """
    q = job_manager.subscribe_global()

    async def event_generator():
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            job_manager.unsubscribe_global(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{job_id}", response_model=Job)
def get_job(job_id: str) -> Job:
    """Retrieves full details and progress for a single job."""
    job = job_manager.job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/cancel", response_model=Job)
def cancel_job(job_id: str) -> Job:
    """Cancels a queued, waiting, or running job. Returns 409 if already completed."""
    job = job_manager.job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status in (JobStatus.succeeded, JobStatus.empty, JobStatus.failed, JobStatus.cancelled):
        raise HTTPException(status_code=409, detail=f"Job is already finished with status '{job.status.value}'")

    return job_manager.cancel_job(job_id)


@router.post("/{job_id}/retry", response_model=Job, status_code=201)
def retry_job(job_id: str) -> Job:
    """Clones a previous job's request parameters and enqueues a new job."""
    job = job_manager.job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job_manager.retry_job(job_id)


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str) -> Response:
    """
    Deletes a completed job and its log file from disk.
    Returns 409 if the job is active or queued. Output results files are preserved.
    """
    job = job_manager.job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status in (JobStatus.running, JobStatus.waiting, JobStatus.queued):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete active job with status '{job.status.value}'",
        )

    job_manager.job_store.delete_job(job_id)
    return Response(status_code=204)


@router.get("/{job_id}/logs")
def get_job_logs(
    job_id: str,
    format: Literal["text", "json"] = Query("text", description="Output format: 'text' or 'json'"),
):
    """Returns complete logs for the job as plain text or structured JSON entries."""
    job = job_manager.job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if format == "json":
        entries: list[LogEntry] = job_manager.job_store.get_log_entries(job_id)
        return entries

    text_log = job_manager.job_store.get_log_text(job_id)
    return PlainTextResponse(text_log)


@router.get("/{job_id}/events")
async def stream_job_events(job_id: str, request: Request):
    """
    Server-Sent Events stream for a specific job per SPEC-API §5:
    1. Sends snapshot event with current Job model.
    2. Replays buffered logs respecting Last-Event-ID if provided.
    3. Streams live events until 'done' is sent.
    4. Sends ': ping\\n\\n' every 15s to keep connection alive.
    """
    job = job_manager.job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Parse Last-Event-ID header if client is reconnecting
    last_event_id_hdr = request.headers.get("last-event-id")
    min_seq = 0
    if last_event_id_hdr and last_event_id_hdr.strip().isdigit():
        min_seq = int(last_event_id_hdr.strip())

    q = job_manager.subscribe(job_id)

    async def event_generator():
        try:
            # 1. Send initial snapshot
            yield format_sse("snapshot", job)

            # 2. Replay buffered logs
            logs = job_manager.job_store.get_log_entries(job_id)
            highest_replayed_seq = min_seq
            for entry in logs:
                if entry.seq > min_seq:
                    yield format_sse("log", entry, event_id=entry.seq)
                    if entry.seq > highest_replayed_seq:
                        highest_replayed_seq = entry.seq

            # 3. If job is already terminated, yield done and close stream
            current_job = job_manager.job_store.get_job(job_id) or job
            if current_job.status in (
                JobStatus.succeeded,
                JobStatus.empty,
                JobStatus.failed,
                JobStatus.cancelled,
            ):
                yield format_sse("done", current_job)
                return

            # 4. Stream live events until done
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15.0)

                    # Deduplicate any log message that might have been replayed from buffer
                    if "event: log" in msg and "id: " in msg:
                        try:
                            for line in msg.split("\n"):
                                if line.startswith("id: "):
                                    seq_val = int(line[4:].strip())
                                    if seq_val <= highest_replayed_seq:
                                        # Skip already replayed log
                                        continue
                        except Exception:
                            pass

                    yield msg

                    if "event: done" in msg:
                        break
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            job_manager.unsubscribe(job_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
