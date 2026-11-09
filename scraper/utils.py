"""
scraper/utils.py — Shared utility helpers used across the scraper package.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, unquote, urlencode, urlparse

from loguru import logger

from config import (
    ADS_LIBRARY_BASE_URL,
    DEFAULT_ACTIVE_STATUS,
    DEFAULT_AD_TYPE,
    DEFAULT_COUNTRY,
    DEFAULT_MEDIA_TYPE,
    DEFAULT_PLATFORM,
    DEFAULT_SEARCH_TYPE_EXACT,
    DEFAULT_SEARCH_TYPE_KEYWORD,
    DEFAULT_SEARCH_TYPE_PAGE,
    IG_PROFILE_REGEX,
)

_IG_COMPILED_RE = re.compile(IG_PROFILE_REGEX, re.IGNORECASE)


def safe_get(obj: Any, *keys: str, default: Any = None) -> Any:
    """
    Safely traverse a nested dict/list structure without raising exceptions.

    Parameters
    ----------
    obj:
        The root object to traverse.
    *keys:
        Sequence of string keys (for dicts) or integer-castable strings (for list indexes).
    default:
        Value returned when any key is missing or a type error occurs.

    Returns
    -------
    Any
        The value at the resolved path, or *default* on any failure.
    """
    current = obj
    for key in keys:
        try:
            if isinstance(current, dict):
                current = current[key]
            elif isinstance(current, list):
                current = current[int(key)]
            else:
                return default
        except (KeyError, IndexError, TypeError, ValueError):
            return default
    return current


def parse_timestamp(value: Any) -> Optional[date]:
    """
    Convert a Unix timestamp (int/float/str) or ISO-8601 string to a :class:`date`.

    Parameters
    ----------
    value:
        Raw value from the scraped payload. May be an int (Unix epoch),
        a numeric string, an ISO-8601 date string, or None.

    Returns
    -------
    Optional[date]
        Parsed date object, or None when the value is absent or unparseable.
    """
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return datetime.utcfromtimestamp(value).date()
        if isinstance(value, str):
            v = value.strip()
            if not v:
                return None
            if v.isdigit():
                return datetime.utcfromtimestamp(int(v)).date()
            for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
                try:
                    return datetime.strptime(v, fmt).date()
                except ValueError:
                    continue
    except Exception as exc:  # noqa: BLE001
        logger.debug("parse_timestamp could not parse value={!r}: {}", value, exc)
    return None


def strip_meta_json_prefix(raw: str, prefix: str = "for (;;);") -> str:
    """
    Remove the CSRF-protection prefix Meta prepends to some JSON responses.

    Parameters
    ----------
    raw:
        Raw response body string received from the network.
    prefix:
        The expected anti-hijacking prefix.

    Returns
    -------
    str
        Clean JSON string ready for :func:`json.loads`.
    """
    raw = raw.strip()
    if raw.startswith(prefix):
        return raw[len(prefix):]
    return raw




def deduplicate_ads(ads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate ads from *ads* using ``ad_id`` as the unique key.

    The first occurrence of each ``ad_id`` is kept; subsequent duplicates are
    discarded.  Ads with an empty or missing ``ad_id`` are always kept (they
    cannot be meaningfully deduplicated).

    Parameters
    ----------
    ads:
        List of raw ad dictionaries.

    Returns
    -------
    List[Dict[str, Any]]
        Deduplicated list with original order preserved.
    """
    seen: set[str] = set()
    result: List[Dict[str, Any]] = []
    for ad in ads:
        ad_id = str(ad.get("ad_id", "")).strip()
        if ad_id and ad_id not in seen:
            seen.add(ad_id)
            result.append(ad)
        elif not ad_id:
            result.append(ad)
    return result

def unwrap_meta_redirect(url: Optional[str]) -> Optional[str]:
    """
    Si la URL viene envuelta en el redireccionador de Meta (l.facebook.com/l.php?u=...
    o l.instagram.com/?u=...), extrae y decodifica la URL real de destino.
    """
    if not url:
        return None
    parsed = urlparse(url.strip())
    if parsed.netloc in ("l.facebook.com", "lm.facebook.com", "l.instagram.com"):
        qs = parse_qs(parsed.query)
        if "u" in qs and qs["u"]:
            return unquote(qs["u"][0])
    return url.strip()


def extract_ig_username(url: Optional[str]) -> Optional[str]:
    """
    Devuelve el username limpio de Instagram si la URL corresponde a un perfil
    válido de Instagram. Si es una web externa, un post (/p/) o un reel, devuelve None.
    """
    clean_url = unwrap_meta_redirect(url)
    if not clean_url:
        return None

    # A veces Meta usa instagram.com/_u/<username> en enlaces de botón "Ir al perfil"
    clean_url = re.sub(
        r"^(https?://(?:www\.)?instagram\.com)/_u/",
        r"\1/",
        clean_url,
        flags=re.IGNORECASE,
    )

    match = _IG_COMPILED_RE.match(clean_url)
    if match:
        return match.group(1).lower()
    return None


def is_instagram_profile_url(url: Optional[str]) -> bool:
    """True si la landing_page apunta directamente a un perfil de Instagram."""
    return extract_ig_username(url) is not None


def build_search_url(
    keyword: Optional[str] = None,
    page_url: Optional[str] = None,
    slug: Optional[str] = None,
    country: str = DEFAULT_COUNTRY,
    active_status: str = DEFAULT_ACTIVE_STATUS,
    platform: Optional[str] = DEFAULT_PLATFORM,
    media_type: str = DEFAULT_MEDIA_TYPE,
    min_date: Optional[str] = None,
    max_date: Optional[str] = None,
    exact_phrase: bool = False,
) -> str:
    """
    Construye la URL completa de la Meta Ads Library con todos los filtros nativos.
    """
    query_target = keyword or slug or (
        (page_url or "").rstrip("/").rsplit("/", 1)[-1]
    )

    # Si el usuario pasa --exact, forzamos comillas y search_type=keyword_exact_phrase
    if keyword and exact_phrase:
        search_type = DEFAULT_SEARCH_TYPE_EXACT
        if not (query_target.startswith('"') and query_target.endswith('"')):
            query_target = f'"{query_target}"'
    elif keyword:
        search_type = DEFAULT_SEARCH_TYPE_KEYWORD
    else:
        search_type = DEFAULT_SEARCH_TYPE_PAGE

    params: dict[str, str] = {
        "active_status": active_status.lower(),
        "ad_type": DEFAULT_AD_TYPE,
        "country": country.upper(),
        "q": query_target,
        "search_type": search_type,
    }

    if media_type and media_type.lower() != "all":
        params["media_type"] = media_type.lower()

    if platform:
        # Formato exacto que espera Meta en la URL para filtrar por plataforma
        params["publisher_platforms[0]"] = platform.lower()

    if min_date:
        params["start_date[min]"] = min_date  # Formato YYYY-MM-DD

    if max_date:
        params["start_date[max]"] = max_date  # Formato YYYY-MM-DD

    return f"{ADS_LIBRARY_BASE_URL}?{urlencode(params)}"
