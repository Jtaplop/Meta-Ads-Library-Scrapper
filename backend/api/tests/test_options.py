"""
test_options.py — Verification that Pydantic schema Literals match config.py constants
and options catalog is fully populated.
"""

from __future__ import annotations

from typing import get_args

import config
from api.options import COUNTRY_GROUPS, PREDEFINED_RECIPES, get_options
from api.schemas import ScrapeRequest


def test_schema_literals_match_config():
    # 1. Active statuses
    status_type = ScrapeRequest.model_fields["status"].annotation
    status_literals = set(get_args(status_type))
    assert status_literals == set(config.VALID_ACTIVE_STATUSES), (
        f"Mismatch: schema={status_literals} vs config={config.VALID_ACTIVE_STATUSES}"
    )

    # 2. Platforms (Union[Literal[...], None])
    platform_union = get_args(ScrapeRequest.model_fields["platform"].annotation)
    platform_literals = set()
    for arg in platform_union:
        literals = get_args(arg)
        if literals:
            platform_literals.update(literals)
    assert platform_literals == set(config.VALID_PLATFORMS), (
        f"Mismatch: schema={platform_literals} vs config={config.VALID_PLATFORMS}"
    )

    # 3. Media types
    media_type = ScrapeRequest.model_fields["media_type"].annotation
    media_literals = set(get_args(media_type))
    assert media_literals == set(config.VALID_MEDIA_TYPES), (
        f"Mismatch: schema={media_literals} vs config={config.VALID_MEDIA_TYPES}"
    )


def test_get_options_catalog():
    opts = get_options()

    assert set(opts.statuses) == set(config.VALID_ACTIVE_STATUSES)
    assert set(opts.platforms) == set(config.VALID_PLATFORMS)
    assert set(opts.media_types) == set(config.VALID_MEDIA_TYPES)

    assert opts.defaults["country"] == config.DEFAULT_COUNTRY
    assert opts.defaults["limit"] == 50
    assert opts.defaults["format"] == "csv"

    assert len(opts.countries) >= 4
    all_codes = {item.code for group in opts.countries for item in group.items}
    assert "ES" in all_codes
    assert "US" in all_codes
    assert "ALL" in all_codes

    assert len(opts.recipes) >= 4
    recipe_ids = {r.id for r in opts.recipes}
    assert "ig_lead_gen" in recipe_ids
    assert "winning_ads" in recipe_ids
    assert "pain_sweep" in recipe_ids
    assert "external_funnels" in recipe_ids

    assert opts.limits["hard_max"] == 1000
    assert opts.config["HEADLESS"] == config.HEADLESS
    assert opts.config["MAX_SCROLL_ATTEMPTS"] == config.MAX_SCROLL_ATTEMPTS
