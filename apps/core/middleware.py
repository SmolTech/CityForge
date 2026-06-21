from __future__ import annotations

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse

from apps.accounts.auth import mobile_user_from_request


class MobileApiCsrfBypassMiddleware:
    """Skip CSRF checks only for API requests that use Bearer token authentication.

    This avoids CSRF enforcement on state-changing mobile API endpoints that
    authenticate via Authorization header rather than session cookies. The bypass
    is intentionally scoped to API paths so that a fake Authorization header cannot
    be used to bypass CSRF on session-cookie-authenticated web endpoints.
    """

    API_PATH_PREFIX = "/api/"

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        auth_header = request.headers.get("authorization", "")
        if request.path_info.startswith(self.API_PATH_PREFIX) and auth_header.startswith("Bearer "):
            setattr(request, "_dont_enforce_csrf_checks", True)  # noqa: B010
        return self.get_response(request)


class MobileBearerAuthMiddleware:
    """Authenticate API requests that present a valid mobile Bearer token.

    This middleware runs after Django's session-based AuthenticationMiddleware.
    If the request is anonymous but carries a valid mobile JWT, it sets
    request.user so that API views can use the standard is_authenticated check.
    """

    API_PATH_PREFIX = "/api/"

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.path_info.startswith(self.API_PATH_PREFIX) and not request.user.is_authenticated:
            user = mobile_user_from_request(request)
            if user is not None:
                request.user = user
        return self.get_response(request)
