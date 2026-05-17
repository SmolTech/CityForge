from __future__ import annotations

from django.conf import settings
from django.db.utils import OperationalError, ProgrammingError

SITE_NAME_KEY = "site_name"
SITE_TAGLINE_KEY = "site_tagline"


def get_site_config() -> dict[str, str]:
    values = {
        "SITE_NAME": settings.SITE_NAME,
        "SITE_TAGLINE": settings.SITE_TAGLINE,
    }
    try:
        from apps.resources.models import ResourceConfig

        rows = ResourceConfig.objects.filter(key__in=[SITE_NAME_KEY, SITE_TAGLINE_KEY]).values_list(
            "key", "value"
        )
    except (OperationalError, ProgrammingError):
        return values

    for key, value in rows:
        if key == SITE_NAME_KEY:
            values["SITE_NAME"] = value
        elif key == SITE_TAGLINE_KEY:
            values["SITE_TAGLINE"] = value
    return values


def set_site_config(site_name: str, site_tagline: str) -> None:
    from apps.resources.models import ResourceConfig

    ResourceConfig.objects.update_or_create(
        key=SITE_NAME_KEY,
        defaults={
            "value": site_name,
            "description": "Display name shown in the site header and title.",
        },
    )
    ResourceConfig.objects.update_or_create(
        key=SITE_TAGLINE_KEY,
        defaults={
            "value": site_tagline,
            "description": "Short tagline shown on the homepage and footer.",
        },
    )
