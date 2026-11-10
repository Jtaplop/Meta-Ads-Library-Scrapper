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
XHR_URL_PATTERNS: list[str] = [
    "ads/library/async/search_ads",
    "ads/archive",
    "graphql",
]
META_JSON_PREFIX: str = "for (;;);"

# ---------------------------------------------------------------------------
# Search defaults & Filter constants
# ---------------------------------------------------------------------------
DEFAULT_COUNTRY: str = "ALL"
DEFAULT_AD_TYPE: str = "all"
DEFAULT_ACTIVE_STATUS: str = "active"  # Cambiado a 'active' por defecto
DEFAULT_SEARCH_TYPE_KEYWORD: str = "keyword_unordered"
DEFAULT_SEARCH_TYPE_EXACT: str = "keyword_exact_phrase"
DEFAULT_SEARCH_TYPE_PAGE: str = "page"

DEFAULT_PLATFORM: str | None = None    # "instagram", "facebook", "messenger", "audience_network"
DEFAULT_MEDIA_TYPE: str = "all"        # "video", "image", "memes", "none", "all"

VALID_ACTIVE_STATUSES: tuple[str, ...] = ("active", "inactive", "all")
VALID_PLATFORMS: tuple[str, ...] = ("instagram", "facebook", "messenger", "audience_network")
VALID_MEDIA_TYPES: tuple[str, ...] = ("all", "video", "image", "memes", "none")

# ---------------------------------------------------------------------------
# Instagram Profile Regex & Redirection
# ---------------------------------------------------------------------------
# Valida URLs de perfiles de Instagram (ej: https://www.instagram.com/usuario/)
# Excluye rutas de contenido (/p/, /reel/, /stories/, /explore/, etc.)
IG_PROFILE_REGEX: str = (
    r"^https?://(?:www\.)?instagram\.com/"
    r"(?!(?:p|reel|reels|tv|stories|explore|accounts|direct|about|developer|legal|directory|lite)/)"
    r"([a-zA-Z0-9._]{1,30})/?(?:\?.*)?$"
)

# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------
ADS_PER_PAGE: int = 30
MAX_SCROLL_ATTEMPTS: int = 50
SCROLL_PAUSE_SECONDS: float = 2.5
NO_NEW_ADS_THRESHOLD: int = 3
# Cuando filtramos por perfil de IG en memoria, varios scrolls seguidos pueden
# traer solo webs externas; subimos la tolerancia antes de parar.
NO_NEW_ADS_THRESHOLD_FILTERED: int = 20

# ---------------------------------------------------------------------------
# Browser / network
# ---------------------------------------------------------------------------
HEADLESS: bool = True
BROWSER_TIMEOUT_MS: int = 30_000
NAVIGATION_TIMEOUT_MS: int = 60_000
NETWORK_IDLE_TIMEOUT_MS: int = 5_000
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