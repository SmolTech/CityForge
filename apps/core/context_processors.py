"""Site-wide template context."""

from django.conf import settings


def site(request):
    return {
        "SITE_NAME": settings.SITE_NAME,
        "SITE_TAGLINE": settings.SITE_TAGLINE,
    }
