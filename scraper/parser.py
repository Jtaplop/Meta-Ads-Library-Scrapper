"""
scraper/parser.py — Parsing logic for Meta Ads Library responses.

Strategy
--------
1. Attempt XHR/GraphQL JSON parsing on intercepted response bodies first.
2. Try several known payload paths where Meta embeds ad arrays.
3. Fall back to a recursive scan of the JSON tree for ad-like objects.
4. If XHR yields nothing, fall back to DOM scraping via Playwright selectors.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from loguru import logger
from playwright.async_api import Page

from scraper.utils import parse_timestamp, safe_get, strip_meta_json_prefix


# ---------------------------------------------------------------------------
# XHR / JSON payload parser
# ---------------------------------------------------------------------------


def parse_xhr_response(raw_body: str) -> List[Dict[str, Any]]:
    """
    Parse a raw XHR/GraphQL response body from the Meta Ads Library.

    The body may be prefixed with ``for (;;);`` which is stripped before JSON
    decoding.  Several known payload structures are tried in sequence before
    falling back to a recursive tree search.

    Parameters
    ----------
    raw_body:
        Raw text content of the intercepted network response.

    Returns
    -------
    List[Dict[str, Any]]
        Extracted, normalised ad dictionaries (may be empty if the format
        is unrecognised or the response contains no ads).
    """
    cleaned = strip_meta_json_prefix(raw_body)
    if not cleaned:
        return []

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.warning("XHR response is not valid JSON: {}", exc)
        return []

    # --- Try known structural paths in order of likelihood ---
    candidates: List[Any] = [
        safe_get(data, "payload", "results"),
        safe_get(data, "data", "ad_library_main", "search_results_connection", "nodes"),
        safe_get(data, "data", "ads_archive_cursor", "results"),
        safe_get(data, "data", "ad_library_ads_data", "results"),
        safe_get(data, "results"),
    ]

    for candidate in candidates:
        if isinstance(candidate, list) and candidate:
            ads = [_normalise_xhr_ad(a) for a in candidate if isinstance(a, dict)]
            logger.debug("XHR: extracted {} ads from known payload path", len(ads))
            return ads

    # --- Generic recursive fallback ---
    ads = _recursive_find_ads(data)
    if ads:
        logger.debug("XHR: extracted {} ads via recursive tree search", len(ads))
    return ads


def _recursive_find_ads(obj: Any, depth: int = 0) -> List[Dict[str, Any]]:
    """
    Recursively search *obj* for dicts that contain ad-identifying keys.

    Parameters
    ----------
    obj:
        Arbitrary JSON-decoded Python object.
    depth:
        Current recursion depth — search is capped at 12 levels.

    Returns
    -------
    List[Dict[str, Any]]
        All ad-like dictionaries found anywhere in the structure.
    """
    if depth > 12:
        return []
    ads: List[Dict[str, Any]] = []
    if isinstance(obj, dict):
        # Presence of ad_archive_id (or its camelCase alias) identifies an ad node
        if "ad_archive_id" in obj or "adArchiveID" in obj:
            ads.append(_normalise_xhr_ad(obj))
        else:
            for v in obj.values():
                ads.extend(_recursive_find_ads(v, depth + 1))
    elif isinstance(obj, list):
        for item in obj:
            ads.extend(_recursive_find_ads(item, depth + 1))
    return ads


def _normalise_xhr_ad(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map a raw Meta API ad dictionary to the normalised field schema.

    Handles several known variations of the API response structure, including
    the ``snapshot`` sub-object and ``cards`` array used for carousel ads.

    Parameters
    ----------
    raw:
        Single ad entry from the API response.

    Returns
    -------
    Dict[str, Any]
        Flat dictionary whose keys match the :class:`~models.ad.Ad` field names.
    """
    snapshot: Dict[str, Any] = safe_get(raw, "snapshot") or {}
    cards: List[Any] = safe_get(snapshot, "cards") or []

    # --- Body text (ad copy) ---
    body_text: Optional[str] = (
        safe_get(snapshot, "body", "markup", "__html")
        or safe_get(snapshot, "body_translations", "0")
        or (safe_get(cards, "0", "body") if cards else None)
        or safe_get(raw, "ad_creative_bodies", "0")
        or None
    )

    # --- Caption / headline ---
    caption: Optional[str] = (
        safe_get(snapshot, "title")
        or (safe_get(cards, "0", "title") if cards else None)
        or safe_get(raw, "ad_creative_link_titles", "0")
        or None
    )

    # --- Media: image ---
    image_url: Optional[str] = (
        safe_get(snapshot, "images", "0", "original_image_url")
        or safe_get(snapshot, "images", "0", "resized_image_url")
        or (safe_get(cards, "0", "original_image_url") if cards else None)
        or None
    )

    # --- Media: video ---
    video_url: Optional[str] = (
        safe_get(snapshot, "videos", "0", "video_hd_url")
        or safe_get(snapshot, "videos", "0", "video_sd_url")
        or (safe_get(cards, "0", "video_hd_url") if cards else None)
        or (safe_get(cards, "0", "video_sd_url") if cards else None)
        or None
    )

    # --- Landing page ---
    landing_page: Optional[str] = (
        safe_get(snapshot, "link_url")
        or (safe_get(cards, "0", "link_url") if cards else None)
        or safe_get(raw, "ad_creative_link_captions", "0")
        or None
    )

    # --- Core identifiers ---
    ad_id: str = str(
        raw.get("ad_archive_id")
        or raw.get("adArchiveID")
        or raw.get("id")
        or ""
    ).strip()

    page_id: Optional[str] = str(
        raw.get("page_id") or raw.get("pageID") or ""
    ).strip() or None

    page_name: Optional[str] = str(
        raw.get("page_name") or raw.get("pageName") or ""
    ).strip() or None

    # --- Status ---
    is_active = raw.get("is_active")
    if is_active is True:
        status = "ACTIVE"
    elif is_active is False:
        status = "INACTIVE"
    else:
        status = (str(raw.get("ad_delivery_status", "")) or "UNKNOWN").upper()

    # --- Publisher platforms ---
    platforms: List[str] = raw.get("publisher_platforms") or []
    if isinstance(platforms, str):
        platforms = [p.strip() for p in platforms.split(",") if p.strip()]

    # --- Snapshot link ---
    snapshot_url: Optional[str] = (
        f"https://www.facebook.com/ads/library/?id={ad_id}" if ad_id else None
    )

    return {
        "ad_id": ad_id,
        "page_id": page_id,
        "page_name": page_name,
        "ad_text": body_text,
        "ad_caption": caption,
        "start_date": parse_timestamp(raw.get("ad_delivery_start_time")),
        "end_date": parse_timestamp(raw.get("ad_delivery_stop_time")),
        "status": status,
        "image_url": image_url,
        "video_url": video_url,
        "landing_page": landing_page,
        "platforms": platforms,
        "snapshot_url": snapshot_url,
    }


# ---------------------------------------------------------------------------
# DOM / HTML parser (fallback)
# ---------------------------------------------------------------------------


async def parse_dom_ads(page: Page) -> List[Dict[str, Any]]:
    """
    Extract ad data from the rendered DOM of the Meta Ads Library page.

    This is the fallback path when XHR interception yields no results.
    Tries several CSS selectors targeting the Ads Library UI card structure.

    Parameters
    ----------
    page:
        Playwright :class:`~playwright.async_api.Page` positioned at the
        search results URL.

    Returns
    -------
    List[Dict[str, Any]]
        Raw ad dicts extracted from visible card elements; may be empty if
        no matching cards are found.
    """
    # Candidate selectors targeting ad card containers in Meta's DOM structure
    card_selectors: List[str] = [
        "[data-testid='ad-card']",
        "div._7jyr",
        "div[class*='_99s3']",
        "div[class*='_8mdi']",
        "div[class*='_4bl9']",
        "div[aria-label*='Ad by']",
    ]

    cards: List[Any] = []
    for selector in card_selectors:
        try:
            found = await page.query_selector_all(selector)
            if found:
                logger.debug("DOM: found {} cards using selector '{}'", len(found), selector)
                cards = found
                break
        except Exception as exc:  # noqa: BLE001
            logger.debug("DOM selector '{}' raised an error: {}", selector, exc)

    if not cards:
        logger.warning("DOM fallback: no ad card elements found on the current page")
        return []

    ads: List[Dict[str, Any]] = []
    for idx, card in enumerate(cards):
        try:
            ad = await _extract_dom_card(card, idx)
            if ad:
                ads.append(ad)
        except Exception as exc:  # noqa: BLE001
            logger.debug("DOM: failed to parse card index {}: {}", idx, exc)

    logger.info("DOM fallback: extracted {} ads from {} cards", len(ads), len(cards))
    return ads


async def _extract_dom_card(card: Any, idx: int) -> Optional[Dict[str, Any]]:
    """
    Extract fields from a single DOM ad card element handle.

    Parameters
    ----------
    card:
        Playwright ``ElementHandle`` for one ad card.
    idx:
        Zero-based position used as fallback ``ad_id`` when no archive ID
        can be derived from the DOM.

    Returns
    -------
    Optional[Dict[str, Any]]
        Parsed ad dict, or None if the card contains no useful data.
    """

    async def _text(selector: str) -> str:
        el = await card.query_selector(selector)
        if el:
            return (await el.text_content() or "").strip()
        return ""

    async def _attr(selector: str, attribute: str) -> str:
        el = await card.query_selector(selector)
        if el:
            return (await el.get_attribute(attribute) or "").strip()
        return ""

    # Attempt to pull the archive ID from an anchor href pointing to the library
    card_link: str = await _attr("a[href*='/ads/library/?id=']", "href")
    id_match = re.search(r"[?&]id=(\d+)", card_link)
    ad_id: str = id_match.group(1) if id_match else f"dom_{idx}"

    page_name: str = await _text("a[href*='facebook.com/']")
    ad_text: str = (
        await _text("div[data-testid='ad-card-message']")
        or await _text("div._4bl9")
        or await _text("div[class*='_7jvw']")
    )
    image_url: str = await _attr("img", "src")
    video_url: str = await _attr("video source", "src")

    # Skip completely empty cards
    if not ad_id.startswith("dom_") and not page_name and not ad_text:
        return None

    return {
        "ad_id": ad_id,
        "page_id": None,
        "page_name": page_name or None,
        "ad_text": ad_text or None,
        "ad_caption": None,
        "start_date": None,
        "end_date": None,
        "status": "UNKNOWN",
        "image_url": image_url or None,
        "video_url": video_url or None,
        "landing_page": card_link or None,
        "platforms": [],
        "snapshot_url": card_link or None,
    }
