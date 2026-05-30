from __future__ import annotations

import json
import logging
import time
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

_request_id_context: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    return _request_id_context.get()


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = getattr(record, "request_id", None) or get_request_id()
        record.method = getattr(record, "method", None)
        record.path = getattr(record, "path", None)
        record.status_code = getattr(record, "status_code", None)
        record.duration_ms = getattr(record, "duration_ms", None)
        record.user_id = getattr(record, "user_id", None)
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
            "method": getattr(record, "method", None),
            "path": getattr(record, "path", None),
            "status_code": getattr(record, "status_code", None),
            "duration_ms": getattr(record, "duration_ms", None),
            "user_id": getattr(record, "user_id", None),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps({key: value for key, value in payload.items() if value is not None})


class RequestLoggingMiddleware:
    _logger = logging.getLogger("apps.request")

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _user_id(request) -> int | None:
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return int(user.pk)
        return None

    def __call__(self, request):
        started_at = time.monotonic()
        request_id = request.META.get("HTTP_X_REQUEST_ID", "").strip() or str(uuid.uuid4())
        request.request_id = request_id
        token = _request_id_context.set(request_id)
        try:
            response = self.get_response(request)
        except Exception:
            duration_ms = int((time.monotonic() - started_at) * 1000)
            self._logger.exception(
                "request.failed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "user_id": self._user_id(request),
                },
            )
            _request_id_context.reset(token)
            raise

        duration_ms = int((time.monotonic() - started_at) * 1000)
        response["X-Request-ID"] = request_id
        level = logging.ERROR if response.status_code >= 500 else logging.INFO
        self._logger.log(
            level,
            "request.completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "user_id": self._user_id(request),
            },
        )
        _request_id_context.reset(token)
        return response
