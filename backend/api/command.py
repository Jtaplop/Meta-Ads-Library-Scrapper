"""
command.py — CLI argument builder and human-friendly preview formatter.
"""

from __future__ import annotations

import shlex
from pathlib import Path

from api import settings
from api.schemas import ScrapeRequest, SearchMode


def build_command(
    req: ScrapeRequest,
    python_exe: str | None = None,
    cli_entry: Path | None = None,
) -> list[str]:
    """
    Constructs the exact argument list to run the CLI scraper via subprocess.
    Always uses long flags, shell=False safe list, and includes --verbose.
    """
    exe = python_exe or settings.PYTHON_EXE
    entry = str(cli_entry or settings.CLI_ENTRY)

    mode_val = req.mode.value if isinstance(req.mode, SearchMode) else str(req.mode)
    flag_map = {
        "keyword": "--keyword",
        "page_url": "--page-url",
        "slug": "--slug",
    }
    flag = flag_map.get(mode_val, "--keyword")

    args: list[str] = [exe, entry, flag, req.query]

    args.extend([
        "--country", req.country,
        "--status", req.status,
        "--media", req.media_type,
        "--format", req.format,
        "--limit", str(req.limit),
        "--verbose",
    ])

    if req.platform:
        args.extend(["--platform", req.platform])
    if req.min_date:
        args.extend(["--min-date", req.min_date.isoformat()])
    if req.exact:
        args.append("--exact")
    if req.only_ig_profile:
        args.append("--only-ig-profile")

    return args


def format_cli_preview(req: ScrapeRequest) -> str:
    """
    Formats a user-friendly, copiable command string for display in the UI.
    """
    mode_val = req.mode.value if isinstance(req.mode, SearchMode) else str(req.mode)
    flag_map = {
        "keyword": "--keyword",
        "page_url": "--page-url",
        "slug": "--slug",
    }
    flag = flag_map.get(mode_val, "--keyword")

    parts: list[str] = [
        "python main.py",
        flag,
        shlex.quote(req.query),
        "--country", req.country,
        "--status", req.status,
        "--media", req.media_type,
        "--format", req.format,
        "--limit", str(req.limit),
    ]

    if req.platform:
        parts.extend(["--platform", req.platform])
    if req.min_date:
        parts.extend(["--min-date", req.min_date.isoformat()])
    if req.exact:
        parts.append("--exact")
    if req.only_ig_profile:
        parts.append("--only-ig-profile")

    parts.append("--verbose")

    return " ".join(parts)
