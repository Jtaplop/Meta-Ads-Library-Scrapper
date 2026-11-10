"""
batches.py — Batch execution router for running multiple search queries sequentially.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.jobs import job_manager
from api.schemas import BatchDetailResponse, BatchRequest

router = APIRouter(prefix="/batches", tags=["Batches"])


@router.post("", response_model=BatchDetailResponse, status_code=201)
def create_batch(req: BatchRequest) -> BatchDetailResponse:
    """Creates and enqueues a batch of queries with configured pause between jobs."""
    batch = job_manager.enqueue_batch(req)
    detail = job_manager.get_batch_detail(batch.id)
    if not detail:
        raise HTTPException(status_code=500, detail="Failed to initialize batch")
    return detail


@router.get("", response_model=list[BatchDetailResponse])
def list_batches() -> list[BatchDetailResponse]:
    """Lists all stored batches with aggregate execution statistics."""
    batches = sorted(
        job_manager.job_store._batches.values(),
        key=lambda b: b.created_at,
        reverse=True,
    )
    results: list[BatchDetailResponse] = []
    for b in batches:
        detail = job_manager.get_batch_detail(b.id)
        if detail:
            results.append(detail)
    return results


@router.get("/{batch_id}", response_model=BatchDetailResponse)
def get_batch(batch_id: str) -> BatchDetailResponse:
    """Retrieves aggregated details, progress, and job list for a specific batch."""
    detail = job_manager.get_batch_detail(batch_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Batch not found")
    return detail


@router.post("/{batch_id}/cancel", response_model=BatchDetailResponse)
def cancel_batch(batch_id: str) -> BatchDetailResponse:
    """Cancels all pending and currently running jobs belonging to the batch."""
    detail = job_manager.get_batch_detail(batch_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Batch not found")

    job_manager.cancel_batch(batch_id)
    updated = job_manager.get_batch_detail(batch_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Batch not found")
    return updated
