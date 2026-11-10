"""
main.py — CLI entry point for the Meta Ads Library scraper.

Usage examples
--------------
    python main.py -k "psicologia" -c ES -pl instagram -m video -st active --min-date 2025-11-01 --exact --only-ig-profile -f csv -l 100
    python main.py --keyword nike --format csv --limit 50
    python main.py --slug cocacola --format json --limit 100
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import typer
from loguru import logger

from config import (
    DEFAULT_ACTIVE_STATUS,
    DEFAULT_COUNTRY,
    DEFAULT_MEDIA_TYPE,
    OUTPUT_DIR,
    VALID_ACTIVE_STATUSES,
    VALID_MEDIA_TYPES,
    VALID_PLATFORMS,
)
from exporters.csv_exporter import CsvExporter
from exporters.json_exporter import JsonExporter
from scraper.ads_scraper import AdsScraper

app = typer.Typer(
    name="meta-ads-scraper",
    help="Scrape ads from the Meta Ads Library and export them to CSV or JSON.",
    add_completion=False,
)


def _configure_logging(verbose: bool) -> None:
    logger.remove()
    level = "DEBUG" if verbose else "INFO"
    logger.add(
        sys.stderr,
        level=level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level:<8}</level> | "
            "{message}"
        ),
        colorize=True,
    )


@app.command()
def scrape(
    keyword: Optional[str] = typer.Option(
        None, "--keyword", "-k", help="Free-text search keyword."
    ),
    page_url: Optional[str] = typer.Option(
        None, "--page-url", "-p", help="Full Facebook page URL to scrape ads for."
    ),
    slug: Optional[str] = typer.Option(
        None, "--slug", "-s", help="Facebook page slug / username (e.g. 'nike')."
    ),
    fmt: str = typer.Option(
        "json", "--format", "-f", help="Output format: 'csv' or 'json'."
    ),
    limit: int = typer.Option(
        50, "--limit", "-l", help="Maximum number of ads to collect."
    ),
    country: str = typer.Option(
        DEFAULT_COUNTRY, "--country", "-c", help="ISO-3166-1 country code (e.g. 'ES') or 'ALL'."
    ),
    status: str = typer.Option(
        DEFAULT_ACTIVE_STATUS,
        "--status",
        "-st",
        help="Ad status: 'active', 'inactive', or 'all'.",
    ),
    platform: Optional[str] = typer.Option(
        None,
        "--platform",
        "-pl",
        help="Target platform: 'instagram', 'facebook', 'messenger', or 'audience_network'.",
    ),
    media_type: str = typer.Option(
        DEFAULT_MEDIA_TYPE,
        "--media",
        "-m",
        help="Media type: 'video', 'image', 'memes', 'none', or 'all'.",
    ),
    min_date: Optional[str] = typer.Option(
        None,
        "--min-date",
        "-md",
        help="Minimum start date in YYYY-MM-DD format (e.g. '2025-11-01').",
    ),
    exact: bool = typer.Option(
        False,
        "--exact",
        "-e",
        help="Force exact phrase match on keyword search.",
    ),
    only_ig_profile: bool = typer.Option(
        False,
        "--only-ig-profile",
        "-ig",
        help="Only collect ads whose landing page is a valid Instagram profile URL.",
    ),
    verbose: bool = typer.Option(
        False, "--verbose", "-v", help="Enable DEBUG-level logging."
    ),
) -> None:
    """
    Scrape the Meta Ads Library and export the results.
    Exactly one of --keyword, --page-url, or --slug must be supplied.
    """
    _configure_logging(verbose)

    # ------------------------------------------------------------------ #
    # Input validation
    # ------------------------------------------------------------------ #
    provided = sum([bool(keyword), bool(page_url), bool(slug)])
    if provided == 0:
        logger.error("You must provide at least one of --keyword, --page-url, or --slug.")
        raise typer.Exit(code=1)
    if provided > 1:
        logger.error("Only one of --keyword, --page-url, or --slug may be used at a time.")
        raise typer.Exit(code=1)

    fmt = fmt.lower().strip()
    if fmt not in ("csv", "json"):
        logger.error("--format must be 'csv' or 'json', got: {!r}", fmt)
        raise typer.Exit(code=1)

    if limit < 1:
        logger.error("--limit must be a positive integer, got: {}", limit)
        raise typer.Exit(code=1)

    status = status.lower().strip()
    if status not in VALID_ACTIVE_STATUSES:
        logger.error("--status must be one of {}, got: {!r}", VALID_ACTIVE_STATUSES, status)
        raise typer.Exit(code=1)

    if platform is not None:
        platform = platform.lower().strip()
        if platform not in VALID_PLATFORMS:
            logger.error("--platform must be one of {}, got: {!r}", VALID_PLATFORMS, platform)
            raise typer.Exit(code=1)

    media_type = media_type.lower().strip()
    if media_type not in VALID_MEDIA_TYPES:
        logger.error("--media must be one of {}, got: {!r}", VALID_MEDIA_TYPES, media_type)
        raise typer.Exit(code=1)

    if min_date is not None:
        try:
            datetime.strptime(min_date, "%Y-%m-%d")
        except ValueError:
            logger.error("--min-date must be in YYYY-MM-DD format (e.g. '2025-11-01'), got: {!r}", min_date)
            raise typer.Exit(code=1)

    # ------------------------------------------------------------------ #
    # Determine output filename
    # ------------------------------------------------------------------ #
    label = keyword or slug or (page_url or "").rstrip("/").rsplit("/", 1)[-1] or "ads"
    label = "".join(c if c.isalnum() or c in "-_" else "_" for c in label)[:50]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ig_suffix = "_ig_profiles" if only_ig_profile else ""
    filename = f"{label}{ig_suffix}_{timestamp}.{fmt}"

    # ------------------------------------------------------------------ #
    # Run the scraper
    # ------------------------------------------------------------------ #
    scraper = AdsScraper(
        keyword=keyword,
        page_url=page_url,
        slug=slug,
        limit=limit,
        country=country,
        active_status=status,
        platform=platform,
        media_type=media_type,
        min_date=min_date,
        exact_phrase=exact,
        only_ig_profile=only_ig_profile,
    )

    logger.info(
        "Starting scrape | keyword={!r} country={} status={} platform={} media={} min_date={} exact={} only_ig_profile={} limit={}",
        keyword or slug or page_url,
        country,
        status,
        platform or "ALL",
        media_type,
        min_date or "NONE",
        exact,
        only_ig_profile,
        limit,
    )

    try:
        ads = asyncio.run(scraper.run())
    except KeyboardInterrupt:
        logger.warning("Scrape interrupted by user.")
        raise typer.Exit(code=130)
    except Exception as exc:
        logger.error("Scrape failed with an unhandled exception: {}", exc)
        raise typer.Exit(code=1)

    if not ads:
        logger.warning("No ads matched the criteria.")
        raise typer.Exit(code=0)

    logger.info("Collected {} ads — exporting as {}", len(ads), fmt.upper())

    # ------------------------------------------------------------------ #
    # Export
    # ------------------------------------------------------------------ #
    dest: Path
    if fmt == "csv":
        exporter: CsvExporter = CsvExporter(output_dir=OUTPUT_DIR)
        dest = exporter.export(ads, filename)
    else:
        json_exporter: JsonExporter = JsonExporter(output_dir=OUTPUT_DIR)
        dest = json_exporter.export(ads, filename)

    typer.echo(f"Done. Output written to: {dest}")


def main() -> None:
    app()


if __name__ == "__main__":
    main()