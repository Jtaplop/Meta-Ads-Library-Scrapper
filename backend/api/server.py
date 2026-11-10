"""
server.py — FastAPI application setup, CORS, routers, SPA static file serving, and error handlers.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

from api.jobs import job_manager
from api.routers import batches, jobs, results, system
from api.settings import CORS_ORIGINS, FRONTEND_DIST


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown:
    - Starts sequential job queue worker on startup.
    - Cancels running process and cleans up queued jobs on shutdown.
    """
    logger.info("Starting Meta Ads Scraper API bridge...")
    job_manager.start()
    yield
    logger.info("Shutting down Meta Ads Scraper API bridge...")
    await job_manager.shutdown()


app = FastAPI(
    title="Meta Ads Library Scraper API",
    description="Bridge API connecting local desktop/web frontend to the Python CLI scraper.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Exception Handlers (Standard format: {"detail": ..., "code": ...})
# ---------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = "error"
    if exc.headers and "X-Error-Code" in exc.headers:
        code = exc.headers["X-Error-Code"]
    elif exc.status_code == 404:
        code = "not_found"
        if isinstance(exc.detail, str) and "job" in exc.detail.lower():
            code = "job_not_found"
    elif exc.status_code == 409:
        code = "conflict"
    elif exc.status_code == 400:
        code = "bad_request"
        if isinstance(exc.detail, str) and "traversal" in exc.detail.lower():
            code = "invalid_filename"

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": code},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "code": "validation_error"},
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    code = "invalid_request"
    msg = str(exc)
    if "traversal" in msg.lower() or "outside" in msg.lower() or "format" in msg.lower():
        code = "invalid_filename"
    return JSONResponse(
        status_code=400,
        content={"detail": msg, "code": code},
    )


@app.exception_handler(FileNotFoundError)
async def file_not_found_handler(request: Request, exc: FileNotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "not_found"},
    )


# ---------------------------------------------------------------------------
# Mount Routers under /api
# ---------------------------------------------------------------------------
app.include_router(system.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(batches.router, prefix="/api")
app.include_router(results.router, prefix="/api")


# ---------------------------------------------------------------------------
# Serve Frontend Single-Page Application (Production Mode)
# ---------------------------------------------------------------------------
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            return JSONResponse(
                status_code=404,
                content={"detail": "API endpoint not found", "code": "not_found"},
            )
        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return JSONResponse(
            status_code=404,
            content={"detail": "Frontend index.html not found", "code": "not_found"},
        )
