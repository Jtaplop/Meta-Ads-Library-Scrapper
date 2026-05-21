"""
scraper/pagination.py — Pagination controller for the Meta Ads Library.

The Ads Library uses infinite scroll: new cards are injected into the DOM /
fired as XHR responses as the user scrolls toward the bottom of the page.

This module implements a scroll-and-collect loop that:
- Scrolls to the page bottom after each collection pass.
- Waits for network idle (or a fixed pause) after each scroll.
- Tracks how many *new* ads appeared since the previous pass.
- Stops early when the limit is reached or stagnation is detected.
"""

from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, Dict, Any, List

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
) -> List[Dict[str, Any]]:
    """
    Drive infinite-scroll pagination, calling *collect_fn* after each scroll.

    Deduplication within this function is keyed on ``ad_id`` so that ads
    already seen in a previous scroll pass are not double-counted when
    determining whether the page has stagnated.

    Stops when **any** of the following conditions is met:

    * Total unique ads collected reaches *limit*.
    * No new ads are found for :data:`~config.NO_NEW_ADS_THRESHOLD` consecutive
      scroll attempts.
    * :data:`~config.MAX_SCROLL_ATTEMPTS` scroll iterations have been performed.

    Parameters
    ----------
    page:
        Playwright :class:`~playwright.async_api.Page` already positioned at
        the search results URL.
    collect_fn:
        Async callable — invoked after each scroll — that returns a list of
        raw ad dicts from the *entire* visible page (not just the delta).
        The function is expected to return previously seen ads too; dedup is
        handled here.
    limit:
        Maximum number of unique ads to accumulate before stopping.

    Returns
    -------
    List[Dict[str, Any]]
        Unique raw ad dicts, truncated to *limit*.
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
                # Ads with no ID (e.g. DOM-parsed with fallback id) are always appended
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
                NO_NEW_ADS_THRESHOLD,
            )
            if stagnant_count >= NO_NEW_ADS_THRESHOLD:
                logger.info(
                    "Stopping pagination: {} consecutive scrolls with no new ads",
                    NO_NEW_ADS_THRESHOLD,
                )
                break
        else:
            stagnant_count = 0

        if len(all_ads) >= limit:
            logger.info("Stopping pagination: collected limit of {} ads", limit)
            break

        # Scroll to the page bottom and wait for any new network activity
        await _scroll_to_bottom(page)
        try:
            await page.wait_for_load_state(
                "networkidle", timeout=NETWORK_IDLE_TIMEOUT_MS
            )
        except Exception:  # noqa: BLE001
            # networkidle may time-out on busy pages; a fixed pause is sufficient
            await asyncio.sleep(SCROLL_PAUSE_SECONDS)

    return all_ads[:limit]


async def _scroll_to_bottom(page: Page) -> None:
    """
    Scroll the page to its absolute bottom using a JavaScript evaluation.

    Waits :data:`~config.SCROLL_PAUSE_SECONDS` afterwards to allow the
    browser to trigger lazy-load / infinite-scroll handlers.

    Parameters
    ----------
    page:
        Playwright :class:`~playwright.async_api.Page` to scroll.
    """
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    await asyncio.sleep(SCROLL_PAUSE_SECONDS)
