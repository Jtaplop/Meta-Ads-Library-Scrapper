"""
models/ad.py — Pydantic v2 data model for a single Meta Ads Library ad.
"""

from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class Ad(BaseModel):
    """Represents a single advertisement scraped from the Meta Ads Library."""

    ad_id: str = Field(..., description="Unique identifier for the ad (ad_archive_id).")
    page_id: Optional[str] = Field(None, description="Facebook Page ID that ran the ad.")
    page_name: Optional[str] = Field(None, description="Display name of the advertising page.")
    ad_text: Optional[str] = Field(None, description="Primary body text of the ad.")
    ad_caption: Optional[str] = Field(None, description="Short headline or caption.")
    start_date: Optional[date] = Field(None, description="Date the ad started running.")
    end_date: Optional[date] = Field(
        None, description="Date the ad stopped running (None if still active)."
    )
    status: Optional[str] = Field(None, description="'ACTIVE' or 'INACTIVE'.")
    image_url: Optional[str] = Field(None, description="URL of the primary ad image.")
    video_url: Optional[str] = Field(None, description="URL of the primary ad video.")
    landing_page: Optional[str] = Field(
        None, description="Destination URL when the ad is clicked."
    )
    ig_username: Optional[str] = Field(
        None, description="Extracted Instagram username if landing_page is an IG profile."
    )
    platforms: List[str] = Field(
        default_factory=list,
        description="Platforms where the ad ran (e.g. Facebook, Instagram, Messenger).",
    )
    snapshot_url: Optional[str] = Field(
        None, description="Link to the ad's Ads Library snapshot page."
    )

    @model_validator(mode="after")
    def _populate_ig_data(self) -> "Ad":
        # Importación local para evitar el ciclo circular con scraper/__init__.py
        from scraper.utils import extract_ig_username, unwrap_meta_redirect

        if self.landing_page:
            self.landing_page = unwrap_meta_redirect(self.landing_page)
            username = extract_ig_username(self.landing_page)
            if username:
                self.ig_username = username
                self.landing_page = f"https://www.instagram.com/{username}/"
        return self

    @field_validator("status", mode="before")
    @classmethod
    def normalise_status(cls, v: object) -> Optional[str]:
        """Uppercase and strip whitespace from status strings."""
        if isinstance(v, str):
            return v.strip().upper() or None
        return None

    @field_validator("platforms", mode="before")
    @classmethod
    def coerce_platforms(cls, v: object) -> List[str]:
        """Accept a comma-separated string or a list for the platforms field."""
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        if isinstance(v, list):
            return [str(p).strip() for p in v if str(p).strip()]
        return []

    model_config = {"populate_by_name": True}