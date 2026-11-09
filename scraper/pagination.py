"""
scraper/pagination.py — Pagination controller for the Meta Ads Library.
"""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Dict, List

from loguru import logger
from playwright.async_api import Page

from config import (
    MAX_SCROLL_ATTEMPTS,
    NETWORK_IDLE_TIMEOUT_MS,
    NO_NEW_ADS_THRESHOLD,
    SCROLL_PAUSE_SECONDS,
)


async def scroll_and_collect(
    page: Page,
    collect_fn: Callable[[], Awaitable[List[Dict[str, Any]]]],
    limit: int,
    no_new_ads_threshold: int = NO_NEW_ADS_THRESHOLD,
) -> List[Dict[str, Any]]:
    """
    Drive infinite-scroll pagination, calling *collect_fn* after each scroll.
    """
    all_ads: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()
    stagnant_count: int = 0

    for attempt in range(1, MAX_SCROLL_ATTEMPTS + 1):
        logger.debug("Scroll iteration {}/{}", attempt, MAX_SCROLL_ATTEMPTS)

        current_batch = await collect_fn()

        new_ads_this_pass: int = 0
        for ad in current_batch:
            ad_id = str(ad.get("ad_id", "")).strip()
            if ad_id and ad_id not in seen_ids:
                seen_ids.add(ad_id)
                all_ads.append(ad)
                new_ads_this_pass += 1
            elif not ad_id:
                all_ads.append(ad)
                new_ads_this_pass += 1

        logger.debug(
            "Iteration {}: +{} new ads | total={}",
            attempt,
            new_ads_this_pass,
            len(all_ads),
        )

        if new_ads_this_pass == 0:
            stagnant_count += 1
            logger.debug(
                "No new ads on iteration {} (stagnant={}/{})",
                attempt,
                stagnant_count,
                no_new_ads_threshold,
            )
            if stagnant_count >= no_new_ads_threshold:
                logger.info(
                    "Stopping pagination: {} consecutive scrolls with no new ads",
                    no_new_ads_threshold,
                )
                break
        else:
            stagnant_count = 0

        if len(all_ads) >= limit:
            logger.info("Stopping pagination: collected limit of {} ads", limit)
            break

        await _scroll_to_bottom(page)

        try:
            await page.wait_for_load_state(
                "networkidle", timeout=NETWORK_IDLE_TIMEOUT_MS
            )
        except Exception:  # noqa: BLE001
            await asyncio.sleep(SCROLL_PAUSE_SECONDS)

    return all_ads[:limit]


async def _scroll_to_bottom(page: Page) -> None:
    """Scroll the page to its absolute bottom using a JavaScript evaluation."""
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    await asyncio.sleep(SCROLL_PAUSE_SECONDS)