from __future__ import annotations


class MobileApiCsrfBypassMiddleware:
    """Skip CSRF checks only for requests that use Bearer token authentication.

    This avoids CSRF enforcement on state-changing mobile API endpoints that
    authenticate via Authorization header rather than session cookies.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            request._dont_enforce_csrf_checks = True
        return self.get_response(request)
