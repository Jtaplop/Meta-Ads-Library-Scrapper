"""
config.py — Central configuration for meta-ads-scraper.

All hardcoded values are defined here. No magic strings appear in scraper logic.
"""

# ---------------------------------------------------------------------------
# Meta Ads Library URLs
# ---------------------------------------------------------------------------

ADS_LIBRARY_BASE_URL: str = "https://www.facebook.com/ads/library/"
ADS_LIBRARY_ASYNC_URL: str = "https://www.facebook.com/ads/library/async/search_ads/"

# ---------------------------------------------------------------------------
# XHR / GraphQL interception
# ---------------------------------------------------------------------------

# Substrings matched against response URLs to decide whether to capture the body
XHR_URL_PATTERNS: list[str] = [
    "ads/library/async/search_ads",
    "ads/archive",
    "graphql",
]

# Meta prefixes some JSON responses with this string to prevent CSRF hijacking
META_JSON_PREFIX: str = "for (;;);"

# ---------------------------------------------------------------------------
# Search defaults
# ---------------------------------------------------------------------------

DEFAULT_COUNTRY: str = "ALL"
DEFAULT_AD_TYPE: str = "all"
DEFAULT_ACTIVE_STATUS: str = "all"
DEFAULT_SEARCH_TYPE_KEYWORD: str = "keyword_unordered"
DEFAULT_SEARCH_TYPE_PAGE: str = "page"

# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

ADS_PER_PAGE: int = 30

# Hard upper limit on scroll iterations (safety valve)
MAX_SCROLL_ATTEMPTS: int = 50

# Seconds to pause after each scroll before measuring new ads
SCROLL_PAUSE_SECONDS: float = 2.5

# Stop pagination after this many consecutive scrolls that yield zero new ads
NO_NEW_ADS_THRESHOLD: int = 3

# ---------------------------------------------------------------------------
# Browser / network
# ---------------------------------------------------------------------------

HEADLESS: bool = True

# Default timeout for individual Playwright actions (ms)
BROWSER_TIMEOUT_MS: int = 30_000

# Timeout for full page navigation (ms)
NAVIGATION_TIMEOUT_MS: int = 60_000

# Timeout when waiting for networkidle after a scroll (ms)
NETWORK_IDLE_TIMEOUT_MS: int = 5_000

# Extra wait after initial page load before scraping begins (ms)
PAGE_LOAD_WAIT_MS: int = 3_000

# ---------------------------------------------------------------------------
# Retry policy (Tenacity)
# ---------------------------------------------------------------------------

RETRY_MAX_ATTEMPTS: int = 4
RETRY_WAIT_SECONDS_MIN: int = 1
RETRY_WAIT_SECONDS_MAX: int = 10

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

OUTPUT_DIR: str = "output"
