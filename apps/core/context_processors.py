"""Site-wide template context."""

from .site_config import get_site_config


def site(request):
    return get_site_config()
