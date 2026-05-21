"""
scraper/ads_scraper.py — Core Playwright-based async scraper for the Meta Ads Library.

Pipeline
--------
1. Launch a headless Chromium browser via Playwright.
2. Register a response-event listener to capture XHR/GraphQL payloads.
3. Navigate to the Ads Library search URL (with Tenacity retry on failure).
4. Run :func:`~scraper.pagination.scroll_and_collect` to drive infinite scroll.
5. On each collection pass, parse XHR-intercepted bodies first; fall back to
   DOM parsing when no XHR data is available.
6. Deduplicate by ``ad_id`` and validate each record against the
   :class:`~models.ad.Ad` Pydantic model.
7. Return validated :class:`~models.ad.Ad` instances up to ``limit``.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from loguru import logger
from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
    Response,
    async_playwright,
)
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import (
    ADS_PER_PAGE,
    BROWSER_TIMEOUT_MS,
    HEADLESS,
    NAVIGATION_TIMEOUT_MS,
    PAGE_LOAD_WAIT_MS,
    RETRY_MAX_ATTEMPTS,
    RETRY_WAIT_SECONDS_MAX,
    RETRY_WAIT_SECONDS_MIN,
    XHR_URL_PATTERNS,
    ADS_LIBRARY_BASE_URL,
)
from models.ad import Ad
from scraper.pagination import scroll_and_collect
from scraper.parser import parse_dom_ads, parse_xhr_response
from scraper.utils import build_search_url, deduplicate_ads

# ---------------------------------------------------------------------------
# Tenacity retry helpers
# ---------------------------------------------------------------------------


def _log_retry(retry_state: RetryCallState) -> None:
    """
    ``before_sleep`` callback for Tenacity — logs each retry via loguru.

    Parameters
    ----------
    retry_state:
        Tenacity :class:`~tenacity.RetryCallState` for the current attempt.
    """
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    sleep_secs = retry_state.next_action.sleep if retry_state.next_action else 0
    logger.warning(
        "Retry attempt {} — reason: {} — waiting {:.1f}s before next attempt",
        retry_state.attempt_number,
        exc,
        sleep_secs,
    )


# ---------------------------------------------------------------------------
# Main scraper class
# ---------------------------------------------------------------------------


class AdsScraper:
    """
    Async scraper for the Meta Ads Library.

    Instantiate with one search parameter (``keyword``, ``page_url``, or
    ``slug``), then call :meth:`run` from an async context (or let
    :meth:`run` manage the event loop internally).

    Parameters
    ----------
    keyword:
        Free-text search term.
    page_url:
        Full URL of a Facebook Page whose ads to retrieve.
    slug:
        Facebook page slug/username (e.g. ``"nike"``).
    limit:
        Maximum number of validated ads to return (default: ``ADS_PER_PAGE``).
    country:
        ISO-3166-1 alpha-2 country code or ``"ALL"`` for global results.
    """

    def __init__(
        self,
        *,
        keyword: Optional[str] = None,
        page_url: Optional[str] = None,
        slug: Optional[str] = None,
        limit: int = ADS_PER_PAGE,
        country: str = "ALL",
    ) -> None:
        self.keyword = keyword
        self.page_url = page_url
        self.slug = slug
        self.limit = limit
        self.country = country

        # Accumulates raw response bodies captured by the event listener
        self._intercepted_bodies: List[str] = []

        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def run(self) -> List[Ad]:
        """
        Execute the full scrape pipeline and return validated Ad objects.

        Opens and closes the browser automatically.

        Returns
        -------
        List[Ad]
            Deduplicated, Pydantic-validated ads, truncated to ``self.limit``.
        """
        async with async_playwright() as playwright:
            await self._launch_browser(playwright)
            try:
                ads = await self._scrape()
            finally:
                await self._close_browser()
        return ads

    # ------------------------------------------------------------------
    # Browser lifecycle
    # ------------------------------------------------------------------

    async def _launch_browser(self, playwright: Playwright) -> None:
        """
        Launch a headless Chromium instance and create a browser context.

        The user-agent is set to a realistic desktop Chrome string to reduce
        the chance of bot-detection by Meta's infrastructure.

        Parameters
        ----------
        playwright:
            Active :class:`~playwright.async_api.Playwright` manager instance.
        """
        self._browser = await playwright.chromium.launch(
            headless=HEADLESS,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ],
        )
        self._context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            timezone_id="America/New_York",
        )
        self._context.set_default_timeout(BROWSER_TIMEOUT_MS)
        self._page = await self._context.new_page()

        # Register the XHR interception listener before any navigation
        self._page.on("response", self._on_response)
        logger.info("Browser launched (headless={})", HEADLESS)

    async def _close_browser(self) -> None:
        """Gracefully close the browser context and the browser process."""
        try:
            if self._context:
                await self._context.close()
        except Exception as exc:  # noqa: BLE001
            logger.debug("Context already closed: {}", exc)
        try:
            if self._browser:
                await self._browser.close()
        except Exception as exc:  # noqa: BLE001
            logger.debug("Browser already closed: {}", exc)
        logger.info("Browser closed")

    # ------------------------------------------------------------------
    # Network interception
    # ------------------------------------------------------------------

    async def _on_response(self, response: Response) -> None:
        """
        Playwright ``response`` event handler.

        Captures the text body of any response whose URL matches one of the
        patterns in :data:`~config.XHR_URL_PATTERNS`.

        Parameters
        ----------
        response:
            Playwright :class:`~playwright.async_api.Response` event object.
        """
        url = response.url
        if not any(pattern in url for pattern in XHR_URL_PATTERNS):
            return
        try:
            body = await response.text()
            if body and len(body) > 10:
                self._intercepted_bodies.append(body)
                logger.debug("XHR intercepted: {} ({} bytes)", url, len(body))
        except Exception as exc:  # noqa: BLE001
            logger.debug("Could not read body from {}: {}", url, exc)

    # ------------------------------------------------------------------
    # Scraping pipeline
    # ------------------------------------------------------------------

    async def _scrape(self) -> List[Ad]:
        """
        Build the search URL, navigate to it, and collect ads via pagination.

        Returns
        -------
        List[Ad]
            Validated ad objects (at most ``self.limit`` items).
        """
        search_url = build_search_url(
            ADS_LIBRARY_BASE_URL,
            keyword=self.keyword,
            page_url=self.page_url,
            slug=self.slug,
            country=self.country,
        )
        logger.info("Search URL: {}", search_url)

        await self._navigate(search_url)

        raw_ads = await scroll_and_collect(
            page=self._page,  # type: ignore[arg-type]
            collect_fn=self._collect_current_ads,
            limit=self.limit,
        )

        deduped = deduplicate_ads(raw_ads)
        logger.info(
            "Collected {} unique raw ads across all scroll passes", len(deduped)
        )

        validated = self._validate_ads(deduped)
        logger.info(
            "Validated {} ads (discarded {})",
            len(validated),
            len(deduped) - len(validated),
        )

        return validated[: self.limit]

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(RETRY_MAX_ATTEMPTS),
        wait=wait_exponential(
            multiplier=1,
            min=RETRY_WAIT_SECONDS_MIN,
            max=RETRY_WAIT_SECONDS_MAX,
        ),
        before_sleep=_log_retry,
        reraise=True,
    )
    async def _navigate(self, url: str) -> None:
        """
        Navigate to *url* with Tenacity retry on any exception.

        Each retry attempt is logged by :func:`_log_retry` including the
        attempt number, error, and wait duration before the next try.

        Parameters
        ----------
        url:
            Target URL to navigate to.
        """
        assert self._page is not None, "_navigate called before browser was launched"
        try:
            await self._page.goto(
                url,
                timeout=NAVIGATION_TIMEOUT_MS,
                wait_until="domcontentloaded",
            )
            await self._page.wait_for_timeout(PAGE_LOAD_WAIT_MS)
            logger.info("Navigation successful: {}", self._page.url)
        except Exception as exc:
            err_str = str(exc)
            # ERR_ABORTED is raised when the browser cancels the original
            # navigation because of a redirect (Facebook's locale/consent
            # flows do this).  If the page has already landed at a real URL
            # we can safely continue rather than treating this as a failure.
            if "ERR_ABORTED" in err_str or "net::ERR_" in err_str:
                current_url = self._page.url
                if current_url and current_url not in ("about:blank", ""):
                    logger.info(
                        "Navigation aborted by redirect — landed at: {}",
                        current_url,
                    )
                    try:
                        await self._page.wait_for_load_state(
                            "domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS
                        )
                    except Exception:  # noqa: BLE001
                        pass
                    await self._page.wait_for_timeout(PAGE_LOAD_WAIT_MS)
                    return  # redirect succeeded — do not re-raise
            logger.warning("Navigation attempt failed: {}", exc)
            raise

    async def _collect_current_ads(self) -> List[Dict[str, Any]]:
        """
        Return all ads visible in the current page state.

        Prioritises XHR-intercepted JSON payloads.  Falls back to DOM parsing
        when the intercepted buffer is empty.

        Returns
        -------
        List[Dict[str, Any]]
            Raw ad dicts sourced from XHR responses or the live DOM.
        """
        # Drain the intercepted buffer and parse every response body
        xhr_ads: List[Dict[str, Any]] = []
        for body in self._intercepted_bodies:
            batch = parse_xhr_response(body)
            xhr_ads.extend(batch)

        if xhr_ads:
            logger.debug(
                "XHR path: {} total ads across {} intercepted responses",
                len(xhr_ads),
                len(self._intercepted_bodies),
            )
            return xhr_ads

        # DOM fallback
        logger.info("No XHR data captured yet — falling back to DOM parsing")
        return await parse_dom_ads(self._page)  # type: ignore[arg-type]

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_ads(raw_ads: List[Dict[str, Any]]) -> List[Ad]:
        """
        Validate raw ad dicts against the :class:`~models.ad.Ad` Pydantic model.

        Records that fail validation are logged as warnings and skipped.

        Parameters
        ----------
        raw_ads:
            List of raw ad dictionaries to validate.

        Returns
        -------
        List[Ad]
            Successfully validated :class:`~models.ad.Ad` instances.
        """
        validated: List[Ad] = []
        for raw in raw_ads:
            try:
                validated.append(Ad.model_validate(raw))
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Validation failed for ad_id={!r}: {}",
                    raw.get("ad_id"),
                    exc,
                )
        return validated
