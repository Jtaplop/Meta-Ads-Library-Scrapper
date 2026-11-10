"""
test_command.py — Unit tests for CLI command builder and CLI preview formatter.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

from api.command import build_command, format_cli_preview
from api.schemas import ScrapeRequest, SearchMode


def test_build_command_default_keyword():
    req = ScrapeRequest(
        mode=SearchMode.keyword,
        query="psicologia",
    )
    cmd = build_command(req, python_exe="python", cli_entry=Path("main.py"))

    assert cmd[0] == "python"
    assert cmd[1] == "main.py"
    assert cmd[2] == "--keyword"
    assert cmd[3] == "psicologia"
    assert "--country" in cmd
    assert cmd[cmd.index("--country") + 1] == "ALL"
    assert "--status" in cmd
    assert cmd[cmd.index("--status") + 1] == "active"
    assert "--media" in cmd
    assert cmd[cmd.index("--media") + 1] == "all"
    assert "--format" in cmd
    assert cmd[cmd.index("--format") + 1] == "csv"
    assert "--limit" in cmd
    assert cmd[cmd.index("--limit") + 1] == "50"
    assert "--verbose" in cmd
    assert "--exact" not in cmd
    assert "--only-ig-profile" not in cmd


def test_build_command_all_flags():
    req = ScrapeRequest(
        mode=SearchMode.keyword,
        query="dentistas madrid",
        country="es",  # Should be normalized to ES
        status="active",
        platform="instagram",
        media_type="video",
        min_date=date(2024, 1, 1),
        exact=True,
        only_ig_profile=True,
        format="json",
        limit=100,
    )
    cmd = build_command(req, python_exe="python", cli_entry=Path("main.py"))

    assert "--country" in cmd and cmd[cmd.index("--country") + 1] == "ES"
    assert "--platform" in cmd and cmd[cmd.index("--platform") + 1] == "instagram"
    assert "--media" in cmd and cmd[cmd.index("--media") + 1] == "video"
    assert "--min-date" in cmd and cmd[cmd.index("--min-date") + 1] == "2024-01-01"
    assert "--format" in cmd and cmd[cmd.index("--format") + 1] == "json"
    assert "--limit" in cmd and cmd[cmd.index("--limit") + 1] == "100"
    assert "--exact" in cmd
    assert "--only-ig-profile" in cmd
    assert "--verbose" in cmd


def test_build_command_page_url_mode():
    req = ScrapeRequest(
        mode=SearchMode.page_url,
        query="https://www.facebook.com/Nike/",
    )
    cmd = build_command(req, python_exe="python", cli_entry=Path("main.py"))
    assert "--page-url" in cmd
    assert cmd[cmd.index("--page-url") + 1] == "https://www.facebook.com/Nike/"


def test_build_command_slug_mode():
    req = ScrapeRequest(
        mode=SearchMode.slug,
        query="nike-official",
    )
    cmd = build_command(req, python_exe="python", cli_entry=Path("main.py"))
    assert "--slug" in cmd
    assert cmd[cmd.index("--slug") + 1] == "nike-official"


def test_format_cli_preview():
    req = ScrapeRequest(
        mode=SearchMode.keyword,
        query="café de especialidad",
        country="ES",
        limit=75,
        only_ig_profile=True,
    )
    preview = format_cli_preview(req)

    assert preview.startswith("python main.py --keyword")
    assert "'café de especialidad'" in preview or '"café de especialidad"' in preview or "café de especialidad" in preview
    assert "--country ES" in preview
    assert "--limit 75" in preview
    assert "--only-ig-profile" in preview
    assert "--verbose" in preview


def test_scrape_request_validation():
    # Invalid country
    with pytest.raises(ValidationError):
        ScrapeRequest(mode=SearchMode.keyword, query="test", country="INVALID")

    # Invalid page_url (not facebook)
    with pytest.raises(ValidationError):
        ScrapeRequest(mode=SearchMode.page_url, query="https://google.com/test")

    # Invalid page_url (no http/https)
    with pytest.raises(ValidationError):
        ScrapeRequest(mode=SearchMode.page_url, query="facebook.com/test")

    # Limit out of range
    with pytest.raises(ValidationError):
        ScrapeRequest(mode=SearchMode.keyword, query="test", limit=0)

    with pytest.raises(ValidationError):
        ScrapeRequest(mode=SearchMode.keyword, query="test", limit=2000)
