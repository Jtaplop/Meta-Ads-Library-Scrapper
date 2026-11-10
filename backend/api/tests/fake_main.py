"""
fake_main.py — Standalone mock CLI script for testing the API runner and parser.
Emits realistic Loguru-formatted output and produces valid CSV or JSON outputs.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Mock scraper for API test suite")
    parser.add_argument("--keyword", type=str, default=None)
    parser.add_argument("--page-url", type=str, default=None)
    parser.add_argument("--slug", type=str, default=None)
    parser.add_argument("--country", type=str, default="ALL")
    parser.add_argument("--status", type=str, default="active")
    parser.add_argument("--platform", type=str, default=None)
    parser.add_argument("--media", type=str, default="all")
    parser.add_argument("--min-date", type=str, default=None)
    parser.add_argument("--exact", action="store_true")
    parser.add_argument("--only-ig-profile", action="store_true")
    parser.add_argument("--format", type=str, default="csv")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("-v", "--verbose", action="store_true")

    args = parser.parse_args()
    query = args.keyword or args.page_url or args.slug or "test_query"

    # 1. EMPTY_TEST branch
    if query == "EMPTY_TEST":
        sys.stderr.write("\x1b[32m2026-11-10 12:00:00\x1b[0m | \x1b[34mINFO\x1b[0m     | Starting scrape | query=EMPTY_TEST\n")
        sys.stderr.write("2026-11-10 12:00:01 | INFO     | Browser launched\n")
        sys.stderr.write("2026-11-10 12:00:02 | INFO     | Search URL: https://www.facebook.com/ads/library/?q=EMPTY_TEST\n")
        sys.stderr.write("2026-11-10 12:00:03 | INFO     | Navigation successful: Page loaded\n")
        sys.stderr.write("2026-11-10 12:00:04 | INFO     | No ads matched the criteria.\n")
        sys.stderr.flush()
        sys.exit(0)

    # 2. FAIL_TEST branch
    if query == "FAIL_TEST":
        sys.stderr.write("2026-11-10 12:00:00 | INFO     | Starting scrape | query=FAIL_TEST\n")
        sys.stderr.write("2026-11-10 12:00:01 | ERROR    | Scraping crashed unexpectedly\n")
        sys.stderr.flush()
        sys.exit(1)

    # 3. SLOW_TEST branch (for cancellation testing)
    if query == "SLOW_TEST":
        sys.stderr.write("2026-11-10 12:00:00 | INFO     | Starting scrape | query=SLOW_TEST\n")
        sys.stderr.write("2026-11-10 12:00:01 | INFO     | Browser launched\n")
        sys.stderr.flush()
        for _ in range(100):
            time.sleep(0.1)
        sys.exit(0)

    # 4. Standard successful execution
    sys.stderr.write(f"\x1b[32m2026-11-10 12:00:00\x1b[0m | \x1b[34mINFO\x1b[0m     | Starting scrape | query={query}\n")
    sys.stderr.write("2026-11-10 12:00:01 | INFO     | Browser launched\n")
    sys.stderr.write(f"2026-11-10 12:00:02 | INFO     | Search URL: https://www.facebook.com/ads/library/?q={query}\n")
    sys.stderr.write("2026-11-10 12:00:03 | INFO     | Navigation successful: Page loaded\n")
    sys.stderr.write("2026-11-10 12:00:04 | INFO     | Scroll iteration 1/50\n")
    sys.stderr.write("2026-11-10 12:00:05 | INFO     | Iteration 1: +2 new ads | total=2\n")
    sys.stderr.write("2026-11-10 12:00:06 | INFO     | Collected 2 unique raw ads\n")
    sys.stderr.write("2026-11-10 12:00:07 | INFO     | Validated 2 ads (discarded 0)\n")
    sys.stderr.write(f"2026-11-10 12:00:08 | INFO     | Collected 2 ads | exporting as {args.format.upper()}\n")
    sys.stderr.flush()

    output_dir = Path(os.environ.get("MAS_OUTPUT_DIR", "output")).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    slug = re.sub(r"[^\w\-]", "_", query.strip().lower())
    ig_suffix = "_ig_profiles" if args.only_ig_profile else ""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    fmt = args.format.lower()
    filename = f"{slug}{ig_suffix}_{ts}.{fmt}"
    out_path = output_dir / filename

    sample_ads = [
        {
            "ad_id": "111222333444",
            "page_id": "999888777",
            "page_name": "Test Page 1",
            "ad_text": "First test advertisement text",
            "ad_caption": "Caption 1",
            "start_date": "2024-01-10",
            "end_date": None,
            "status": "ACTIVE",
            "image_url": "https://example.com/ad1.jpg",
            "video_url": None,
            "landing_page": "https://example.com/landing1",
            "ig_username": "test_user_1",
            "platforms": ["FACEBOOK", "INSTAGRAM"],
            "snapshot_url": "https://example.com/snapshot1",
        },
        {
            "ad_id": "555666777888",
            "page_id": "999888777",
            "page_name": "Test Page 1",
            "ad_text": "Second test advertisement text",
            "ad_caption": "Caption 2",
            "start_date": "2024-02-15",
            "end_date": None,
            "status": "ACTIVE",
            "image_url": None,
            "video_url": "https://example.com/video2.mp4",
            "landing_page": "https://example.com/landing2",
            "ig_username": "test_user_2",
            "platforms": ["INSTAGRAM"],
            "snapshot_url": "https://example.com/snapshot2",
        },
    ]

    if fmt == "csv":
        fields = list(sample_ads[0].keys())
        with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for ad in sample_ads:
                row = dict(ad)
                row["platforms"] = ", ".join(row["platforms"])
                for k, v in row.items():
                    if v is None:
                        row[k] = ""
                writer.writerow(row)
    else:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(sample_ads, f, indent=2, ensure_ascii=False)

    print(f"Done. Output written to: {out_path.resolve()}", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
