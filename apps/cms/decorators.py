from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse, HttpResponseForbidden


def staff_required(view_func: Callable[..., HttpResponse]) -> Callable[..., HttpResponse]:
    @wraps(view_func)
    @login_required
    def _wrapped(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        user = request.user
        if not (
            user.is_staff or getattr(user, "is_admin", False) or getattr(user, "is_support", False)
        ):
            return HttpResponseForbidden("You do not have access to this area.")
        return view_func(request, *args, **kwargs)

    return _wrapped


def admin_required(view_func: Callable[..., HttpResponse]) -> Callable[..., HttpResponse]:
    @wraps(view_func)
    @login_required
    def _wrapped(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        user = request.user
        if not (user.is_superuser or getattr(user, "is_admin", False)):
            return HttpResponseForbidden("Admin access required.")
        return view_func(request, *args, **kwargs)

    return _wrapped
