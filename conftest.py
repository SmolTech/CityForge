import sys

from django.conf import settings


def pytest_configure():
    """Configure Django settings before tests run."""
    # Override cache settings to use LocMemCache for testing
    if not settings.configured:
        return

    # Only override if running pytest (not during imports)
    if "pytest" in sys.modules:
        settings.CACHES = {
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "unique-snowflake",
            },
            "cards": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "cards",
            },
            "search": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "search",
            },
        }
