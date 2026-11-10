"""
schemas.py — Pydantic v2 data models for the FastAPI bridge.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ============================================================================
# Search & Request Models
# ============================================================================

class SearchMode(str, Enum):
    keyword = "keyword"
    page_url = "page_url"
    slug = "slug"


class ScrapeRequest(BaseModel):
    mode: SearchMode
    query: str = Field(..., min_length=1, max_length=500, description="Keyword, page URL, or slug")
    country: str = Field("ALL", description="ISO-2 uppercase country code (e.g. 'ES') or 'ALL'")
    status: Literal["active", "inactive", "all"] = "active"
    platform: Literal["instagram", "facebook", "messenger", "audience_network"] | None = None
    media_type: Literal["all", "video", "image", "memes", "none"] = "all"
    min_date: date | None = None
    exact: bool = False
    only_ig_profile: bool = False
    format: Literal["csv", "json"] = "csv"
    limit: int = Field(50, ge=1, le=1000, description="Maximum number of valid ads to scrape")

    @field_validator("country", mode="before")
    @classmethod
    def validate_country(cls, v: object) -> str:
        if isinstance(v, str):
            clean = v.strip().upper()
            if re.match(r"^[A-Z]{2}$|^ALL$", clean):
                return clean
        raise ValueError("country debe ser un código ISO-2 (ej. 'ES') o 'ALL'")

    @model_validator(mode="after")
    def validate_mode_and_query(self) -> ScrapeRequest:
        if self.mode == SearchMode.page_url:
            q_clean = self.query.strip().lower()
            if not (q_clean.startswith("http://") or q_clean.startswith("https://")):
                raise ValueError("Para el modo 'page_url', la query debe comenzar por http:// o https://")
            if not ("facebook.com" in q_clean or "fb.com" in q_clean):
                raise ValueError("Para el modo 'page_url', la query debe contener facebook.com o fb.com")
        return self

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


# ============================================================================
# Job & Execution State Models
# ============================================================================

class JobStatus(str, Enum):
    queued = "queued"
    waiting = "waiting"        # Pausa anti-bloqueo antes de arrancar
    running = "running"
    succeeded = "succeeded"    # exit 0 + fichero generado
    empty = "empty"            # exit 0 + "No ads matched the criteria."
    failed = "failed"          # exit != 0 o excepción
    cancelled = "cancelled"


class JobPhase(str, Enum):
    starting = "starting"      # proceso lanzado
    browser = "browser"        # "Browser launched"
    navigating = "navigating"  # "Search URL:" / "Navigation successful"
    collecting = "collecting"  # iteraciones de scroll
    validating = "validating"  # "Collected N unique raw ads" / "Validated"
    exporting = "exporting"    # "exporting as CSV|JSON"
    finished = "finished"


class JobProgress(BaseModel):
    collected: int = 0
    limit: int = 50
    iteration: int = 0
    max_iterations: int = 50
    stagnant: int = 0
    stagnant_threshold: int | None = None
    unique_ig_profiles: int | None = None
    retries: int = 0
    raw_unique: int | None = None
    validated: int | None = None
    discarded: int | None = None
    wait_remaining_seconds: int | None = None

    model_config = ConfigDict(extra="ignore")


class LogEntry(BaseModel):
    seq: int
    ts: str
    level: str
    message: str
    raw: str

    model_config = ConfigDict(extra="ignore")


class WarningEvent(BaseModel):
    kind: Literal["retry", "validation", "navigation"]
    message: str
    ts: str

    model_config = ConfigDict(extra="ignore")


class Job(BaseModel):
    id: str
    batch_id: str | None = None
    request: ScrapeRequest
    command: list[str]
    status: JobStatus = JobStatus.queued
    phase: JobPhase | None = None
    progress: JobProgress
    search_url: str | None = None
    result_file: str | None = None
    error: str | None = None
    exit_code: int | None = None
    pid: int | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    pause_before: int = 0

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class JobsListResponse(BaseModel):
    items: list[Job]
    total: int


# ============================================================================
# Batches
# ============================================================================

class BatchRequest(BaseModel):
    queries: list[str] = Field(..., min_length=1, max_length=50, description="List of search queries")
    base: ScrapeRequest
    pause_seconds: int = Field(150, ge=0, le=1800, description="Pause in seconds between batch jobs")

    model_config = ConfigDict(extra="ignore")


class Batch(BaseModel):
    id: str
    queries: list[str]
    base: ScrapeRequest
    pause_seconds: int
    job_ids: list[str]
    created_at: datetime

    model_config = ConfigDict(extra="ignore")


class BatchDetailResponse(BaseModel):
    id: str
    queries: list[str]
    pause_seconds: int
    created_at: datetime
    jobs: list[Job]
    status: str
    total_jobs: int
    completed_jobs: int
    total_collected: int
    total_limit: int

    model_config = ConfigDict(extra="ignore")


# ============================================================================
# Results & Records
# ============================================================================

class ResultFile(BaseModel):
    filename: str
    label: str
    ig_profiles_only: bool
    format: Literal["csv", "json"]
    created_at: datetime
    size_bytes: int
    rows: int | None = None
    job_id: str | None = None

    model_config = ConfigDict(extra="ignore")


class AdRecord(BaseModel):
    ad_id: str
    page_id: str | None = None
    page_name: str | None = None
    ad_text: str | None = None
    ad_caption: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    landing_page: str | None = None
    ig_username: str | None = None
    platforms: list[str] = Field(default_factory=list)
    snapshot_url: str | None = None

    @field_validator(
        "page_id",
        "page_name",
        "ad_text",
        "ad_caption",
        "start_date",
        "end_date",
        "image_url",
        "video_url",
        "landing_page",
        "ig_username",
        "snapshot_url",
        mode="before",
    )
    @classmethod
    def empty_str_to_none(cls, v: object) -> object:
        if isinstance(v, str):
            stripped = v.strip()
            return stripped if stripped else None
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: object) -> str | None:
        if isinstance(v, str):
            s = v.strip().upper()
            return s if s else None
        return None

    @field_validator("platforms", mode="before")
    @classmethod
    def normalize_platforms(cls, v: object) -> list[str]:
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        if isinstance(v, list):
            return [str(p).strip() for p in v if str(p).strip()]
        return []

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ResultDetailResponse(BaseModel):
    file: ResultFile
    rows: list[AdRecord]


class MergeRequest(BaseModel):
    filenames: list[str] = Field(..., min_length=1)
    dedupe_by: Literal["ad_id", "ig_username", "page_id"] = "ad_id"


class MergeResponse(BaseModel):
    rows: list[AdRecord]
    total_before_dedupe: int
    total_after_dedupe: int


# ============================================================================
# Options, Recipes & Health
# ============================================================================

class CountryItem(BaseModel):
    code: str
    name: str


class CountryGroup(BaseModel):
    group: str
    items: list[CountryItem]


class Recipe(BaseModel):
    id: str
    name: str
    description: str
    is_batch: bool = False
    queries: list[str] | None = None
    params: dict[str, Any]

    model_config = ConfigDict(extra="ignore")


class OptionsResponse(BaseModel):
    statuses: list[str]
    platforms: list[str]
    media_types: list[str]
    defaults: dict[str, Any]
    countries: list[CountryGroup]
    recipes: list[Recipe]
    limits: dict[str, Any]
    config: dict[str, Any]

    model_config = ConfigDict(extra="ignore")


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    python: str
    playwright_ok: bool
    output_dir: str
    queue_size: int
    active_job_id: str | None = None

    model_config = ConfigDict(extra="ignore")
