"""Caching utilities for CityForge."""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from functools import wraps
from typing import Any

from django.core.cache import cache


def _get_cache(name: str) -> Any:
    backend = cache
    if hasattr(cache, "get_client"):
        return cache.get_client(name)
    return backend


def cache_key(*args: Any, **kwargs: Any) -> str:
    """Generate a cache key from arguments."""
    key_parts = list(args) + [f"{k}={v}" for k, v in sorted(kwargs.items())]
    key_str = ":".join(str(p) for p in key_parts)
    # Use hash if key is too long (Redis max key size is 512MB but we want to keep it reasonable)
    if len(key_str) > 200:
        return hashlib.sha256(key_str.encode()).hexdigest()
    return key_str


def cache_result(
    timeout: int = 300,
    cache_name: str = "default",
    key_prefix: str = "",
) -> Callable:
    """Decorator to cache function results.

    Args:
        timeout: Cache timeout in seconds
        cache_name: Name of cache from CACHES configuration
        key_prefix: Prefix for cache keys

    Example:
        @cache_result(timeout=600, cache_name="cards")
        def get_cards(category=None):
            return Card.objects.filter(category=category)
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Build cache key
            cache_obj = _get_cache(cache_name)
            prefix = key_prefix or func.__name__
            key = f"{prefix}:{cache_key(*args, **kwargs)}"

            # Try to get from cache
            result = cache_obj.get(key)
            if result is not None:
                return result

            # Call function and cache result
            result = func(*args, **kwargs)
            cache_obj.set(key, result, timeout)
            return result

        return wrapper

    return decorator


def invalidate_cache(pattern: str, cache_name: str = "default") -> int:
    """Invalidate cache keys matching a pattern.

    Args:
        pattern: Pattern to match (supports * wildcard)
        cache_name: Name of cache from CACHES configuration

    Returns:
        Number of keys deleted
    """
    cache_obj = _get_cache(cache_name)
    keys = cache_obj.keys(pattern)
    if keys:
        return int(cache_obj.delete(*keys))
    return 0


def get_or_set_cache(
    key: str,
    func: Callable,
    timeout: int = 300,
    cache_name: str = "default",
) -> Any:
    """Get value from cache or set it by calling function.

    Args:
        key: Cache key
        func: Function to call if cache miss
        timeout: Cache timeout in seconds
        cache_name: Name of cache from CACHES configuration

    Returns:
        Cached or computed value
    """
    cache_obj = _get_cache(cache_name)
    result = cache_obj.get(key)
    if result is not None:
        return result

    result = func()
    cache_obj.set(key, result, timeout)
    return result


def cache_page_conditional(
    timeout: int = 300,
    cache_name: str = "default",
    condition: Callable | None = None,
) -> Callable:
    """Decorator to conditionally cache view responses.

    Args:
        timeout: Cache timeout in seconds
        cache_name: Name of cache from CACHES configuration
        condition: Optional function to determine if response should be cached

    Example:
        @cache_page_conditional(timeout=600, condition=lambda r: r.status_code == 200)
        def my_view(request):
            ...
    """

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request: Any, *args: Any, **kwargs: Any) -> Any:
            # Only cache GET requests without query params
            if request.method != "GET" or request.GET:
                return view_func(request, *args, **kwargs)

            cache_obj = _get_cache(cache_name)
            cache_key_str = f"view:{request.path}:{request.GET.urlencode()}"
            cached = cache_obj.get(cache_key_str)
            if cached is not None:
                return cached

            response = view_func(request, *args, **kwargs)

            # Only cache successful responses by default
            if condition is None:
                should_cache = response.status_code == 200
            else:
                should_cache = condition(response)

            if should_cache:
                cache_obj.set(cache_key_str, response, timeout)

            return response

        return wrapper

    return decorator
