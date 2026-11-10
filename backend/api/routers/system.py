"""
system.py — Health and options endpoints.
"""

from __future__ import annotations

import sys
from fastapi import APIRouter

from api.jobs import job_manager
from api.options import get_options
from api.schemas import HealthResponse, OptionsResponse
from api.settings import OUTPUT_DIR

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Returns system status, environment information, and queue state."""
    try:
        import playwright  # noqa: F401
        playwright_ok = True
    except ImportError:
        playwright_ok = False

    py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    return HealthResponse(
        status="ok",
        version="1.0.0",
        python=py_version,
        playwright_ok=playwright_ok,
        output_dir=str(OUTPUT_DIR),
        queue_size=job_manager.queue.qsize(),
        active_job_id=job_manager.active_job_id,
    )


@router.get("/options", response_model=OptionsResponse)
def get_system_options() -> OptionsResponse:
    """Returns valid statuses, platforms, country groups, recipes, and scraper limits."""
    return get_options()
