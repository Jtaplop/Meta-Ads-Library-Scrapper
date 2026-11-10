"""
scraper/ads_scraper.py — Core Playwright-based async scraper for the Meta Ads Library.

Pipeline
--------
1. Launch a headless Chromium browser via Playwright.
2. Register a response-event listener to capture XHR/GraphQL payloads.
3. Navigate to the Ads Library search URL (with Tenacity retry on failure).
4. Run :func:`~scraper.pagination.scroll_and_collect` to drive infinite scroll.
5. On each collection pass, parse XHR-intercepted bodies first; fall back to
   DOM parsing when no XHR data is available, and apply in-flight filters.
6. Deduplicate by ``ad_id`` and validate each record against the
   :class:`~models.ad.Ad` Pydantic model.
7. Return validated :class:`~models.ad.Ad` instances up to ``limit``.
"""

from __future__ import annotations

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
    BROWSER_TIMEOUT_MS,
    DEFAULT_ACTIVE_STATUS,
    DEFAULT_COUNTRY,
    DEFAULT_MEDIA_TYPE,
    DEFAULT_PLATFORM,
    HEADLESS,
    NAVIGATION_TIMEOUT_MS,
    NO_NEW_ADS_THRESHOLD,
    NO_NEW_ADS_THRESHOLD_FILTERED,
    PAGE_LOAD_WAIT_MS,
    RETRY_MAX_ATTEMPTS,
    RETRY_WAIT_SECONDS_MAX,
    RETRY_WAIT_SECONDS_MIN,
    XHR_URL_PATTERNS,
)
from models.ad import Ad
from scraper.pagination import scroll_and_collect
from scraper.parser import parse_dom_ads, parse_xhr_response
from scraper.utils import (
    build_search_url,
    deduplicate_ads,
    is_instagram_profile_url,
)


# ---------------------------------------------------------------------------
# Tenacity retry helpers
# ---------------------------------------------------------------------------
def _log_retry(retry_state: RetryCallState) -> None:
    """``before_sleep`` callback for Tenacity — logs each retry via loguru."""
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
    """Async scraper for the Meta Ads Library."""

    def __init__(
        self,
        keyword: str | None = None,
        page_url: str | None = None,
        slug: str | None = None,
        limit: int = 50,
        country: str = DEFAULT_COUNTRY,
        active_status: str = DEFAULT_ACTIVE_STATUS,
        platform: str | None = DEFAULT_PLATFORM,
        media_type: str = DEFAULT_MEDIA_TYPE,
        min_date: str | None = None,
        exact_phrase: bool = False,
        only_ig_profile: bool = False,
    ) -> None:
        self.keyword = keyword
        self.page_url = page_url
        self.slug = slug
        self.limit = limit
        self.country = country
        self.active_status = active_status
        self.platform = platform
        self.media_type = media_type
        self.min_date = min_date
        self.exact_phrase = exact_phrase
        self.only_ig_profile = only_ig_profile

        # Si filtramos por perfil de IG en memoria, damos más margen de scrolls sin resultados nuevos
        self.no_new_ads_threshold = (
            NO_NEW_ADS_THRESHOLD_FILTERED if only_ig_profile else NO_NEW_ADS_THRESHOLD
        )

        # Estado interno del navegador y buffer de respuestas XHR
        self._intercepted_bodies: List[str] = []
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------
    async def run(self) -> List[Ad]:
        """Execute the full scrape pipeline and return validated Ad objects."""
        self._intercepted_bodies = []
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
        """Launch a headless Chromium instance and create a browser context."""
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
        """Capture XHR/GraphQL response bodies matching XHR_URL_PATTERNS."""
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
        """Build the search URL, navigate to it, and collect ads via pagination."""
        search_url = build_search_url(
            keyword=self.keyword,
            page_url=self.page_url,
            slug=self.slug,
            country=self.country,
            active_status=self.active_status,
            platform=self.platform,
            media_type=self.media_type,
            min_date=self.min_date,
            exact_phrase=self.exact_phrase,
        )
        logger.info("Search URL: {}", search_url)

        await self._navigate(search_url)

        raw_ads = await scroll_and_collect(
            page=self._page,  # type: ignore[arg-type]
            collect_fn=self._collect_current_ads,
            limit=self.limit,
            no_new_ads_threshold=self.no_new_ads_threshold,
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
    

    async def _dismiss_cookie_banner(self) -> None:
        """Cierra el modal de cookies de Meta (GDPR en España/UE) si aparece."""
        if not self._page:
            return
        cookie_selectors = [
            "button[data-cookiebanner='accept_button']",
            "button[data-cookiebanner='accept_only_essential_button']",
            "div[role='dialog'] div[role='button']:has-text('Allow all cookies')",
            "div[role='dialog'] div[role='button']:has-text('Permitir todas las cookies')",
            "div[role='dialog'] div[role='button']:has-text('Rechazar cookies opcionales')",
            "div[role='dialog'] div[role='button']:has-text('Decline optional cookies')",
        ]
        for selector in cookie_selectors:
            try:
                btn = await self._page.query_selector(selector)
                if btn and await btn.is_visible():
                    await btn.click()
                    logger.info("Cookie banner dismissed via selector: {}", selector)
                    await self._page.wait_for_timeout(1000)
                    break
            except Exception:  # noqa: BLE001
                continue

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
        """Navigate to *url* with Tenacity retry on any exception."""
        assert self._page is not None, "_navigate called before browser was launched"
        try:
            await self._page.goto(
                url,
                timeout=NAVIGATION_TIMEOUT_MS,
                wait_until="domcontentloaded",
            )
            await self._page.wait_for_timeout(PAGE_LOAD_WAIT_MS)
            await self._dismiss_cookie_banner()
            logger.info("Navigation successful: {}", self._page.url)
        except Exception as exc:
            err_str = str(exc)
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
                    await self._dismiss_cookie_banner()
                    return
            logger.warning("Navigation attempt failed: {}", exc)
            raise

    async def _collect_current_ads(self) -> List[Dict[str, Any]]:
        """
        Parsea tanto los anuncios del SSR inicial (DOM) como los nuevos cuerpos XHR,
        aplicando el filtro de perfil de IG si está activo.
        """
        ads: List[Dict[str, Any]] = []

        # 1. Extraer anuncios de las respuestas XHR interceptadas
        while self._intercepted_bodies:
            body = self._intercepted_bodies.pop(0)
            batch = parse_xhr_response(body)
            ads.extend(batch)

        # 2. En la primera pasada (o si aún no hay XHR), extraer también los anuncios SSR del HTML
        dom_ads = await parse_dom_ads(self._page)  # type: ignore[arg-type]
        ads.extend(dom_ads)

        logger.debug("Raw ads extracted in this pass (before IG filter): {}", len(ads))

        # 3. Filtro en caliente por perfil de Instagram
        if self.only_ig_profile:
            ads = [
                ad for ad in ads
                if is_instagram_profile_url(ad.get("landing_page"))
            ]
            logger.debug("Ads matching Instagram profile URL in this pass: {}", len(ads))

        return ads

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    @staticmethod
    def _validate_ads(raw_ads: List[Dict[str, Any]]) -> List[Ad]:
        """Validate raw ad dicts against the Pydantic Ad model."""
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