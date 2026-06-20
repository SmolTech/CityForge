"""Site-wide template context."""

from django.http import HttpRequest

from .site_config import get_site_config


def site(request: HttpRequest) -> dict[str, str]:
    return get_site_config()
