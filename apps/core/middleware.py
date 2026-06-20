from __future__ import annotations

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse


class MobileApiCsrfBypassMiddleware:
    """Skip CSRF checks only for requests that use Bearer token authentication.

    This avoids CSRF enforcement on state-changing mobile API endpoints that
    authenticate via Authorization header rather than session cookies.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            setattr(request, "_dont_enforce_csrf_checks", True)  # noqa: B010
        return self.get_response(request)
