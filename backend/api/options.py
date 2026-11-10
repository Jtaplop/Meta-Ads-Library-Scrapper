"""
options.py — Options catalog, predefined recipes, country groups, and config reader.
"""

from __future__ import annotations

from typing import Any

import config
from api.schemas import (
    CountryGroup,
    CountryItem,
    OptionsResponse,
    Recipe,
)

# ---------------------------------------------------------------------------
# Country Catalog (from backend/docs/Own Plugin.md)
# ---------------------------------------------------------------------------
COUNTRY_GROUPS: list[CountryGroup] = [
    CountryGroup(
        group="Mercado Hispano",
        items=[
            CountryItem(code="ES", name="España"),
            CountryItem(code="MX", name="México"),
            CountryItem(code="CO", name="Colombia"),
            CountryItem(code="AR", name="Argentina"),
            CountryItem(code="CL", name="Chile"),
            CountryItem(code="PE", name="Perú"),
            CountryItem(code="UY", name="Uruguay"),
            CountryItem(code="PA", name="Panamá"),
            CountryItem(code="CR", name="Costa Rica"),
        ],
    ),
    CountryGroup(
        group="Mercado Anglosajón (High-Ticket)",
        items=[
            CountryItem(code="US", name="Estados Unidos"),
            CountryItem(code="GB", name="Reino Unido"),
            CountryItem(code="CA", name="Canadá"),
            CountryItem(code="AU", name="Australia"),
            CountryItem(code="IE", name="Irlanda"),
        ],
    ),
    CountryGroup(
        group="Europa Occidental y Otros Mercados",
        items=[
            CountryItem(code="DE", name="Alemania"),
            CountryItem(code="AT", name="Austria"),
            CountryItem(code="CH", name="Suiza"),
            CountryItem(code="FR", name="Francia"),
            CountryItem(code="IT", name="Italia"),
            CountryItem(code="PT", name="Portugal"),
            CountryItem(code="NL", name="Países Bajos"),
            CountryItem(code="BE", name="Bélgica"),
            CountryItem(code="SE", name="Suecia"),
            CountryItem(code="AE", name="Emiratos Árabes Unidos (Dubái)"),
            CountryItem(code="BR", name="Brasil"),
        ],
    ),
    CountryGroup(
        group="Global",
        items=[
            CountryItem(code="ALL", name="Todo el mundo (Sin filtro geográfico)"),
        ],
    ),
]


# ---------------------------------------------------------------------------
# Predefined Recipes (from SPEC-API §7 and Own Plugin.md)
# ---------------------------------------------------------------------------
PREDEFINED_RECIPES: list[Recipe] = [
    Recipe(
        id="ig_lead_gen",
        name="Captación de perfiles IG",
        description=(
            "Extrae anunciantes con vídeos activos y enlace directo a perfil de Instagram "
            "(ideal para prospección directa de infoproductores, psicólogos y marcas personales)."
        ),
        is_batch=False,
        queries=None,
        params={
            "country": "ES",
            "platform": "instagram",
            "media_type": "video",
            "status": "active",
            "exact": True,
            "only_ig_profile": True,
            "format": "csv",
            "limit": 100,
        },
    ),
    Recipe(
        id="winning_ads",
        name="Anuncios ganadores",
        description=(
            "Detecta anuncios en vídeo que llevan tiempo activos con retorno positivo "
            "(presupuesto continuado y ofertas validadas)."
        ),
        is_batch=False,
        queries=None,
        params={
            "country": "ES",
            "status": "active",
            "media_type": "video",
            "exact": True,
            "format": "csv",
            "limit": 150,
        },
    ),
    Recipe(
        id="pain_sweep",
        name="Barrido por dolores",
        description=(
            "Ejecución en lote buscando síntomas y problemas que resuelven los clientes "
            "en lugar de nombres de profesión."
        ),
        is_batch=True,
        queries=["ansiedad", "autoestima", "terapia online"],
        params={
            "country": "ES",
            "platform": "instagram",
            "media_type": "video",
            "status": "active",
            "only_ig_profile": True,
            "format": "csv",
            "limit": 100,
        },
    ),
    Recipe(
        id="external_funnels",
        name="Embudos externos / WhatsApp",
        description=(
            "Espía anuncios con tráfico hacia sitios web externos, formularios Calendly "
            "o cierres directos por WhatsApp."
        ),
        is_batch=False,
        queries=None,
        params={
            "country": "ES",
            "status": "active",
            "only_ig_profile": False,
            "format": "csv",
            "limit": 100,
        },
    ),
]


# ---------------------------------------------------------------------------
# Options Builder
# ---------------------------------------------------------------------------
def get_options() -> OptionsResponse:
    """Builds and returns the complete options catalog reading config constants."""
    defaults: dict[str, Any] = {
        "country": config.DEFAULT_COUNTRY,
        "status": config.DEFAULT_ACTIVE_STATUS,
        "media_type": config.DEFAULT_MEDIA_TYPE,
        "platform": config.DEFAULT_PLATFORM,
        "format": "csv",
        "limit": 50,
        "exact": False,
        "only_ig_profile": False,
    }

    limits: dict[str, Any] = {
        "recommended_min": 50,
        "recommended_max": 200,
        "hard_max": 1000,
    }

    cfg: dict[str, Any] = {
        "HEADLESS": config.HEADLESS,
        "MAX_SCROLL_ATTEMPTS": config.MAX_SCROLL_ATTEMPTS,
        "SCROLL_PAUSE_SECONDS": config.SCROLL_PAUSE_SECONDS,
        "NO_NEW_ADS_THRESHOLD": config.NO_NEW_ADS_THRESHOLD,
        "NO_NEW_ADS_THRESHOLD_FILTERED": config.NO_NEW_ADS_THRESHOLD_FILTERED,
        "BROWSER_TIMEOUT_MS": config.BROWSER_TIMEOUT_MS,
        "NAVIGATION_TIMEOUT_MS": config.NAVIGATION_TIMEOUT_MS,
        "RETRY_MAX_ATTEMPTS": config.RETRY_MAX_ATTEMPTS,
        "OUTPUT_DIR": str(config.OUTPUT_DIR),
    }

    return OptionsResponse(
        statuses=list(config.VALID_ACTIVE_STATUSES),
        platforms=list(config.VALID_PLATFORMS),
        media_types=list(config.VALID_MEDIA_TYPES),
        defaults=defaults,
        countries=COUNTRY_GROUPS,
        recipes=PREDEFINED_RECIPES,
        limits=limits,
        config=cfg,
    )
