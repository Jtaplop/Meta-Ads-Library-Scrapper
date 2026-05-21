"""
main.py — CLI entry point for the Meta Ads Library scraper.

Usage examples
--------------
    python main.py --keyword nike --format csv --limit 50
    python main.py --slug cocacola --format json --limit 100
    python main.py --page-url https://www.facebook.com/nike --format csv
    python main.py --keyword "electric cars" --country US --format json --verbose
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import typer
from loguru import logger

from config import OUTPUT_DIR
from exporters.csv_exporter import CsvExporter
from exporters.json_exporter import JsonExporter
from scraper.ads_scraper import AdsScraper

app = typer.Typer(
    name="meta-ads-scraper",
    help="Scrape ads from the Meta Ads Library and export them to CSV or JSON.",
    add_completion=False,
)


def _configure_logging(verbose: bool) -> None:
    """
    Set up loguru: remove the default handler and add a formatted console handler.

    Parameters
    ----------
    verbose:
        When True, log level is set to DEBUG; otherwise INFO.
    """
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
        "ALL", "--country", "-c", help="ISO-3166-1 country code (e.g. 'US') or 'ALL'."
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
        logger.error(
            "You must provide at least one of --keyword, --page-url, or --slug."
        )
        raise typer.Exit(code=1)
    if provided > 1:
        logger.error(
            "Only one of --keyword, --page-url, or --slug may be used at a time."
        )
        raise typer.Exit(code=1)

    fmt = fmt.lower().strip()
    if fmt not in ("csv", "json"):
        logger.error("--format must be 'csv' or 'json', got: {!r}", fmt)
        raise typer.Exit(code=1)

    if limit < 1:
        logger.error("--limit must be a positive integer, got: {}", limit)
        raise typer.Exit(code=1)

    # ------------------------------------------------------------------ #
    # Determine output filename
    # ------------------------------------------------------------------ #
    label = keyword or slug or (page_url or "").rstrip("/").rsplit("/", 1)[-1] or "ads"
    # Sanitise the label for use in a filename
    label = "".join(c if c.isalnum() or c in "-_" else "_" for c in label)[:50]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{label}_{timestamp}.{fmt}"

    # ------------------------------------------------------------------ #
    # Run the scraper
    # ------------------------------------------------------------------ #
    scraper = AdsScraper(
        keyword=keyword,
        page_url=page_url,
        slug=slug,
        limit=limit,
        country=country,
    )

    logger.info(
        "Starting scrape — keyword={!r} page_url={!r} slug={!r} limit={} country={}",
        keyword,
        page_url,
        slug,
        limit,
        country,
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
        logger.warning(
            "No ads were collected. The search may have returned no results."
        )
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
    """Invoke the Typer CLI application."""
    app()


if __name__ == "__main__":
    main()
