"""
scraper/utils.py — Shared utility helpers used across the scraper package.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from loguru import logger


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


def build_search_url(
    base_url: str,
    *,
    keyword: Optional[str] = None,
    page_url: Optional[str] = None,
    slug: Optional[str] = None,
    country: str = "ALL",
    ad_type: str = "all",
    active_status: str = "all",
) -> str:
    """
    Construct a Meta Ads Library search URL from the given parameters.

    Exactly one of *keyword*, *page_url*, or *slug* should be provided.

    Parameters
    ----------
    base_url:
        The Ads Library base URL (taken from config).
    keyword:
        Free-text search term — triggers ``search_type=keyword_unordered``.
    page_url:
        Full URL of a Facebook Page whose ads to retrieve.
    slug:
        Facebook page slug/username (e.g. ``"nike"``).
    country:
        ISO-3166-1 alpha-2 country code, or ``"ALL"`` for global results.
    ad_type:
        ``"all"``, ``"political_and_issue_ads"``, etc.
    active_status:
        ``"all"``, ``"active"``, or ``"inactive"``.

    Returns
    -------
    str
        Fully qualified Ads Library search URL.

    Raises
    ------
    ValueError
        When none of *keyword*, *page_url*, or *slug* is provided.
    """
    params: Dict[str, str] = {
        "active_status": active_status,
        "ad_type": ad_type,
        "country": country,
    }

    if keyword:
        params["q"] = keyword
        params["search_type"] = "keyword_unordered"
    elif slug:
        params["q"] = slug
        params["search_type"] = "page"
    elif page_url:
        # Extract the page identifier (slug or ID) from the URL path
        match = re.search(r"facebook\.com/([^/?#]+)", page_url)
        identifier = match.group(1) if match else page_url
        params["q"] = identifier
        params["search_type"] = "page"
    else:
        raise ValueError("One of keyword, page_url, or slug must be provided.")

    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{base_url}?{query_string}"


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
