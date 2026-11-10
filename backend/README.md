# meta-ads-scraper

A production-quality, async Python scraper for the [Meta Ads Library](https://www.facebook.com/ads/library/) that supports keyword search, page URL targeting, and slug-based lookups with structured output, pagination, retries, and CSV/JSON export.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Usage](#usage)
6. [Configuration](#configuration)
7. [Output Schema](#output-schema)
8. [Limitations](#limitations)
9. [Future Improvements](#future-improvements)

---

## Overview

The Meta Ads Library is a public transparency tool that lets anyone search for ads running across Facebook, Instagram, Messenger, and Audience Network. This scraper automates that process programmatically using [Playwright](https://playwright.dev/python/) for browser automation, intercepting XHR/GraphQL network traffic for maximum data richness and falling back to DOM parsing when structured responses are unavailable.

---

## Features

- **Three search modes** — keyword, Facebook page URL, or page slug/username
- **XHR/GraphQL interception** — captures structured JSON payloads from Meta's internal API before they are rendered into the DOM, providing richer data than HTML scraping alone
- **DOM fallback** — gracefully degrades to CSS-selector-based HTML extraction when XHR yields no results
- **Infinite-scroll pagination** — scrolls the page automatically, stopping when the limit is reached or stagnation is detected
- **Tenacity retries** — network-sensitive operations retry up to 4 times with exponential back-off; each attempt is logged
- **Deduplication** — ads are deduplicated by `ad_id` across all scroll passes
- **Pydantic v2 validation** — every scraped record is validated against a typed model before export
- **CSV and JSON export** — CSV via pandas (UTF-8 with BOM for Excel compatibility), JSON via stdlib `json`
- **Loguru logging** — structured, colourised console output with configurable verbosity
- **Typer CLI** — ergonomic command-line interface with `--help` on every option

---

## Architecture

```
meta-ads-scraper/
├── main.py                  # CLI entry point (Typer)
├── config.py                # All constants and tuneable parameters
├── requirements.txt
├── .gitignore
│
├── models/
│   └── ad.py                # Pydantic v2 Ad model (13 fields)
│
├── scraper/
│   ├── ads_scraper.py       # AdsScraper class — orchestrates the pipeline
│   ├── parser.py            # XHR JSON parser + DOM fallback parser
│   ├── pagination.py        # Infinite-scroll controller
│   └── utils.py             # URL builder, timestamp parser, dedup helper
│
├── exporters/
│   ├── csv_exporter.py      # CsvExporter (pandas)
│   └── json_exporter.py     # JsonExporter (stdlib json)
│
└── output/                  # Exported files land here (git-ignored)
```

### Data Flow

```
CLI (main.py)
    │
    ▼
AdsScraper.run()
    │
    ├─► _launch_browser()          # Playwright Chromium, headless
    │       └─ page.on("response") # Register XHR interceptor
    │
    ├─► _navigate(url)             # Tenacity-retried goto()
    │
    └─► scroll_and_collect()       # Pagination loop
            │
            ├─► _collect_current_ads()
            │       ├─ parse_xhr_response()   # XHR path (preferred)
            │       └─ parse_dom_ads()        # DOM fallback
            │
            └─► _scroll_to_bottom()          # JS scroll + network idle wait
                    │
                    ▼
            deduplicate_ads() → _validate_ads() → List[Ad]
                    │
                    ▼
            CsvExporter / JsonExporter → output/<filename>
```

---

## Installation

### Prerequisites

- Python 3.11 or later
- `pip`

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/meta-ads-scraper.git
cd meta-ads-scraper

# 2. Create and activate a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Install Playwright browser binaries (Chromium only)
playwright install chromium
```

---

## Usage

```
python main.py [OPTIONS]
```

### Options

| Option       | Short | Type | Default | Description                      |
| ------------ | ----- | ---- | ------- | -------------------------------- |
| `--keyword`  | `-k`  | TEXT | —       | Free-text search keyword         |
| `--page-url` | `-p`  | TEXT | —       | Full Facebook page URL           |
| `--slug`     | `-s`  | TEXT | —       | Facebook page slug / username    |
| `--format`   | `-f`  | TEXT | `json`  | Output format: `csv` or `json`   |
| `--limit`    | `-l`  | INT  | `50`    | Maximum number of ads to collect |
| `--country`  | `-c`  | TEXT | `ALL`   | ISO-3166-1 country code or `ALL` |
| `--verbose`  | `-v`  | FLAG | `False` | Enable DEBUG-level logging       |

Exactly **one** of `--keyword`, `--page-url`, or `--slug` must be provided.

### Examples

```bash
# Search by keyword, export 100 ads as CSV
python main.py --keyword nike --format csv --limit 100

# Search a specific page by slug, export as JSON
python main.py --slug cocacola --format json --limit 50

# Search by full page URL, restrict to US ads
python main.py --page-url https://www.facebook.com/nike --country US --format csv

# Enable verbose debug logging
python main.py --keyword "electric cars" --format json --verbose
```

Output files are written to the `output/` directory and named:

```
<label>_<YYYYMMDD_HHMMSS>.<format>
# e.g. nike_20260521_143022.csv
```

---

## Configuration

All tuneable constants live in `config.py`. Key parameters:

| Constant                 | Default    | Description                               |
| ------------------------ | ---------- | ----------------------------------------- |
| `HEADLESS`               | `True`     | Run browser in headless mode              |
| `ADS_PER_PAGE`           | `30`       | Default scrape limit                      |
| `MAX_SCROLL_ATTEMPTS`    | `50`       | Hard cap on scroll iterations             |
| `SCROLL_PAUSE_SECONDS`   | `2.5`      | Pause after each scroll (seconds)         |
| `NO_NEW_ADS_THRESHOLD`   | `3`        | Consecutive empty scrolls before stopping |
| `RETRY_MAX_ATTEMPTS`     | `4`        | Tenacity retry count                      |
| `RETRY_WAIT_SECONDS_MIN` | `1`        | Minimum back-off wait (seconds)           |
| `RETRY_WAIT_SECONDS_MAX` | `10`       | Maximum back-off wait (seconds)           |
| `NAVIGATION_TIMEOUT_MS`  | `60000`    | Page navigation timeout (ms)              |
| `OUTPUT_DIR`             | `"output"` | Directory for exported files              |

---

## Output Schema

Each exported ad record contains the following fields:

| Field          | Type           | Description                            |
| -------------- | -------------- | -------------------------------------- |
| `ad_id`        | `str`          | Unique Ads Library archive ID          |
| `page_id`      | `str \| null`  | Facebook Page ID                       |
| `page_name`    | `str \| null`  | Advertiser page display name           |
| `ad_text`      | `str \| null`  | Primary body copy                      |
| `ad_caption`   | `str \| null`  | Headline or short caption              |
| `start_date`   | `date \| null` | Date ad started running                |
| `end_date`     | `date \| null` | Date ad stopped (null if active)       |
| `status`       | `str \| null`  | `ACTIVE`, `INACTIVE`, or `UNKNOWN`     |
| `image_url`    | `str \| null`  | Primary image URL                      |
| `video_url`    | `str \| null`  | Primary video URL                      |
| `landing_page` | `str \| null`  | Click-through destination URL          |
| `platforms`    | `list[str]`    | Platforms the ad ran on                |
| `snapshot_url` | `str \| null`  | Direct link to the Ads Library listing |

---

## Limitations

- **Rate limiting / bot detection** — Meta actively detects automated access. Prolonged scraping sessions may trigger CAPTCHAs or temporary IP blocks. This scraper does not implement CAPTCHA solving.
- **Login wall** — Some ad details (e.g. targeting parameters, spend estimates) are only visible when logged in. This scraper operates without authentication.
- **API instability** — Meta's internal GraphQL schema and DOM structure change without notice. XHR interception paths and DOM selectors may require updates after Meta deploys frontend changes.
- **Geographic restrictions** — Certain ad categories (political/issue ads) are only searchable within specific countries.
- **No proxy support** — The current implementation does not rotate IPs or support proxy configuration. This is a planned enhancement (see below).
- **Windows asyncio** — On Windows, `asyncio.run()` uses the `ProactorEventLoop` which is compatible with Playwright; no additional configuration is needed.

---

## Future Improvements

- **Proxy rotation** — Integrate a proxy pool to distribute requests and reduce block risk.
- **Cookie / session injection** — Support authenticated scraping to access spend estimates and detailed targeting data.
- **Incremental / resumable runs** — Persist the last seen `ad_id` to a state file so runs can resume after interruption.
- **Async export** — Run export concurrently with scraping using `asyncio.Queue`.
- **Additional output formats** — SQLite, PostgreSQL, or Google Sheets export.
- **Automatic selector healing** — Detect selector failures and attempt to re-derive working selectors from the live DOM structure.
- **CAPTCHA detection** — Surface a human-solvable CAPTCHA prompt when bot-detection is triggered, then resume automatically.
- **Docker image** — Package the scraper with Playwright browsers in a reproducible container.
- **Test suite** — Unit tests for parser functions and integration tests using Playwright's network-mocking capabilities.
