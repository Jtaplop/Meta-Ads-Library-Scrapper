"""
results.py — Result files router: listing, detail viewing, downloading, deleting, and merging.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse

from api.jobs import job_manager
from api.results import results_service
from api.schemas import (
    MergeRequest,
    MergeResponse,
    ResultDetailResponse,
    ResultFile,
)

router = APIRouter(prefix="/results", tags=["Results"])


@router.get("", response_model=list[ResultFile])
def list_results(
    q: str | None = Query(None, description="Search query matching filename or label"),
    format: str | None = Query(None, description="Filter by format: 'csv' or 'json'"),
    ig_only: bool | None = Query(None, description="Filter for IG profiles only"),
) -> list[ResultFile]:
    """Scans settings.OUTPUT_DIR for CSV and JSON scraper outputs, sorted by created_at desc."""
    job_file_map: dict[str, str] = {}
    for job in job_manager.job_store._jobs.values():
        if job.result_file:
            job_file_map[job.result_file] = job.id

    return results_service.list_results(
        q=q,
        fmt=format,
        ig_only=ig_only,
        job_file_map=job_file_map,
    )


@router.post("/merge", response_model=MergeResponse)
def merge_results(req: MergeRequest) -> MergeResponse:
    """
    Merges records across multiple result files and deduplicates by ad_id, ig_username, or page_id,
    preserving the earliest start_date. Note: defined before /{filename} to avoid route shadowing.
    """
    try:
        return results_service.merge_results(filenames=req.filenames, dedupe_by=req.dedupe_by)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{filename:path}/download")
def download_result(filename: str):
    """Downloads the result file with Content-Disposition: attachment header."""
    try:
        path = results_service.validate_filename(filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Result file '{filename}' not found")

    media_type = "text/csv" if path.suffix.lower() == ".csv" else "application/json"
    return FileResponse(
        path=path,
        media_type=media_type,
        filename=path.name,
    )


@router.get("/{filename:path}", response_model=ResultDetailResponse)
def get_result(filename: str) -> ResultDetailResponse:
    """Reads all ad records from a specific CSV or JSON result file in OUTPUT_DIR."""
    try:
        return results_service.get_result(filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{filename:path}", status_code=204)
def delete_result(filename: str) -> Response:
    """Deletes the result file from settings.OUTPUT_DIR."""
    try:
        results_service.delete_result(filename)
        return Response(status_code=204)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
