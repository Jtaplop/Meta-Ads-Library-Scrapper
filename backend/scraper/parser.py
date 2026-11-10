"""
scraper/parser.py — Parsing logic for Meta Ads Library responses.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from loguru import logger
from playwright.async_api import Page

from scraper.utils import (
    is_instagram_profile_url,
    parse_timestamp,
    safe_get,
    strip_meta_json_prefix,
    unwrap_meta_redirect,
)


def parse_xhr_response(raw_body: str) -> List[Dict[str, Any]]:
    """
    Parsea respuestas XHR/GraphQL de Meta, soportando tanto un único JSON
    como respuestas en streaming (NDJSON / múltiples líneas JSON).
    """
    cleaned = strip_meta_json_prefix(raw_body)
    if not cleaned:
        return []

    ads: List[Dict[str, Any]] = []
    # Meta GraphQL a veces envía varios objetos JSON separados por salto de línea
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    chunks = [cleaned] if len(lines) <= 1 else lines

    for chunk in chunks:
        chunk_clean = strip_meta_json_prefix(chunk)
        if not chunk_clean or not (chunk_clean.startswith("{") or chunk_clean.startswith("[")):
            continue
        try:
            data = json.loads(chunk_clean)
        except json.JSONDecodeError:
            continue

        ads.extend(_extract_ads_from_json_obj(data))

    return ads


def _extract_ads_from_json_obj(data: Any) -> List[Dict[str, Any]]:
    """Extrae y normaliza anuncios de un objeto JSON ya decodificado."""
    candidates: List[Any] = [
        safe_get(data, "payload", "results"),
        safe_get(data, "data", "ad_library_main", "search_results_connection", "nodes"),
        safe_get(data, "data", "ad_library_main", "search_results_connection", "edges"),
        safe_get(data, "data", "ads_archive_cursor", "results"),
        safe_get(data, "data", "ad_library_ads_data", "results"),
        safe_get(data, "results"),
    ]

    for candidate in candidates:
        if isinstance(candidate, list) and candidate:
            raw_nodes: List[Dict[str, Any]] = []
            for item in candidate:
                if isinstance(item, dict):
                    # En Relay moderno cada nodo suele venir dentro de "collated_results" o "node"
                    node = item.get("node", item)
                    collated = node.get("collated_results")
                    if isinstance(collated, list) and collated:
                        raw_nodes.extend(c for c in collated if isinstance(c, dict))
                    else:
                        raw_nodes.append(node)
            ads = [_normalise_xhr_ad(a) for a in raw_nodes if isinstance(a, dict)]
            if ads:
                return ads

    return _recursive_find_ads(data)


def _recursive_find_ads(obj: Any, depth: int = 0) -> List[Dict[str, Any]]:
    if depth > 14:
        return []
    ads: List[Dict[str, Any]] = []
    if isinstance(obj, dict):
        if ("ad_archive_id" in obj or "adArchiveID" in obj) and "snapshot" in obj:
            ads.append(_normalise_xhr_ad(obj))
        else:
            for v in obj.values():
                ads.extend(_recursive_find_ads(v, depth + 1))
    elif isinstance(obj, list):
        for item in obj:
            ads.extend(_recursive_find_ads(item, depth + 1))
    return ads


def _normalise_xhr_ad(raw: Dict[str, Any]) -> Dict[str, Any]:
    snapshot: Dict[str, Any] = safe_get(raw, "snapshot") or {}
    cards: List[Any] = safe_get(snapshot, "cards") or []

    body_text: Optional[str] = (
        safe_get(snapshot, "body", "text")
        or safe_get(snapshot, "body", "markup", "__html")
        or safe_get(snapshot, "body_translations", "0")
        or (safe_get(cards, "0", "body") if cards else None)
        or safe_get(raw, "ad_creative_bodies", "0")
        or None
    )

    caption: Optional[str] = (
        safe_get(snapshot, "title")
        or (safe_get(cards, "0", "title") if cards else None)
        or safe_get(raw, "ad_creative_link_titles", "0")
        or None
    )

    image_url: Optional[str] = (
        safe_get(snapshot, "images", "0", "original_image_url")
        or safe_get(snapshot, "images", "0", "resized_image_url")
        or (safe_get(cards, "0", "original_image_url") if cards else None)
        or None
    )

    video_url: Optional[str] = (
        safe_get(snapshot, "videos", "0", "video_hd_url")
        or safe_get(snapshot, "videos", "0", "video_sd_url")
        or (safe_get(cards, "0", "video_hd_url") if cards else None)
        or (safe_get(cards, "0", "video_sd_url") if cards else None)
        or None
    )

    # Priorizamos link_url del anuncio o de las tarjetas del carrusel;
    # si no es perfil de IG pero el anunciante tiene page_profile_uri de IG, lo usamos
    candidate_links: List[Optional[str]] = [
        safe_get(snapshot, "link_url"),
        *(safe_get(c, "link_url") for c in cards if isinstance(c, dict)),
        safe_get(snapshot, "page_profile_uri"),
        safe_get(raw, "ad_creative_link_captions", "0"),
    ]
    landing_page: Optional[str] = None
    for link in candidate_links:
        if link and is_instagram_profile_url(link):
            landing_page = link
            break
    if not landing_page:
        landing_page = next((l for l in candidate_links if l), None)

    ad_id: str = str(
        raw.get("ad_archive_id")
        or raw.get("adArchiveID")
        or snapshot.get("ad_archive_id")
        or raw.get("id")
        or ""
    ).strip()

    page_id: Optional[str] = str(
        raw.get("page_id") or raw.get("pageID") or snapshot.get("page_id") or ""
    ).strip() or None

    page_name: Optional[str] = str(
        raw.get("page_name") or raw.get("pageName") or snapshot.get("page_name") or ""
    ).strip() or None

    is_active = raw.get("is_active")
    if is_active is True:
        status = "ACTIVE"
    elif is_active is False:
        status = "INACTIVE"
    else:
        status = (str(raw.get("ad_delivery_status", "")) or "ACTIVE").upper()

    platforms: List[str] = (
        raw.get("publisher_platforms")
        or raw.get("publisherPlatform")
        or []
    )
    if isinstance(platforms, str):
        platforms = [p.strip() for p in platforms.split(",") if p.strip()]

    snapshot_url: Optional[str] = (
        f"https://www.facebook.com/ads/library/?id={ad_id}" if ad_id else None
    )

    return {
        "ad_id": ad_id,
        "page_id": page_id,
        "page_name": page_name,
        "ad_text": body_text,
        "ad_caption": caption,
        "start_date": parse_timestamp(raw.get("ad_delivery_start_time") or raw.get("startDate")),
        "end_date": parse_timestamp(raw.get("ad_delivery_stop_time") or raw.get("endDate")),
        "status": status,
        "image_url": image_url,
        "video_url": video_url,
        "landing_page": landing_page,
        "platforms": platforms,
        "snapshot_url": snapshot_url,
    }


async def parse_embedded_ssr_ads(page: Page) -> List[Dict[str, Any]]:
    """
    Extrae el primer lote de anuncios que Meta inyecta directamente en etiquetas
    <script type="application/json"> durante la carga inicial (SSR).
    """
    ads: List[Dict[str, Any]] = []
    try:
        scripts: List[str] = await page.eval_on_selector_all(
            "script[type='application/json']",
            "elements => elements.map(el => el.textContent || '')",
        )
        for content in scripts:
            if "ad_archive_id" in content or "adArchiveID" in content or "collated_results" in content:
                ads.extend(parse_xhr_response(content))
        if ads:
            logger.debug("SSR JSON: extracted {} initial ads from <script> tags", len(ads))
    except Exception as exc:  # noqa: BLE001
        logger.debug("SSR JSON extraction error: {}", exc)
    return ads


async def parse_dom_ads(page: Page) -> List[Dict[str, Any]]:
    """
    Primero intenta extraer los datos del JSON SSR incrustado en el DOM.
    Si no, busca directamente enlaces en el DOM que apunten a perfiles de IG o CTAs.
    """
    ssr_ads = await parse_embedded_ssr_ads(page)
    if ssr_ads:
        return ssr_ads

    # Fallback visual: buscar todos los enlaces de redirección l.facebook.com o instagram.com en el DOM
    try:
        links_data: List[Dict[str, str]] = await page.eval_on_selector_all(
            "a[href*='instagram.com'], a[href*='l.facebook.com/l.php']",
            """elements => elements.map((el, idx) => ({
                href: el.href || '',
                text: (el.innerText || '').trim(),
                idx: String(idx)
            }))""",
        )
        ads: List[Dict[str, Any]] = []
        for item in links_data:
            href = unwrap_meta_redirect(item.get("href"))
            if not href:
                continue
            ads.append({
                "ad_id": f"dom_{abs(hash(href))}",
                "page_id": None,
                "page_name": item.get("text") or None,
                "ad_text": None,
                "ad_caption": None,
                "start_date": None,
                "end_date": None,
                "status": "ACTIVE",
                "image_url": None,
                "video_url": None,
                "landing_page": href,
                "platforms": ["instagram"],
                "snapshot_url": None,
            })
        return ads
    except Exception as exc:  # noqa: BLE001
        logger.debug("DOM link fallback error: {}", exc)
        return []