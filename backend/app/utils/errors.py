"""
Centralized error handling utilities for the CityForge backend.

This module provides custom exception classes and error response formatting
to ensure consistent error handling across all API endpoints.
"""

import logging
from typing import Any, Dict, Optional

from flask import jsonify
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class APIError(Exception):
    """
    Custom exception class for API errors.

    Attributes:
        message: Human-readable error message
        status_code: HTTP status code (default: 400)
        payload: Additional error details (optional)
    """

    def __init__(
        self, message: str, status_code: int = 400, payload: Optional[Dict[str, Any]] = None
    ):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for JSON response."""
        error_dict = {
            "error": {
                "message": self.message,
                "code": self.status_code,
            }
        }
        if self.payload:
            error_dict["error"]["details"] = self.payload
        return error_dict


class ValidationError(APIError):
    """Raised when request data fails validation."""

    def __init__(self, message: str, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, payload=payload)


class NotFoundError(APIError):
    """Raised when a requested resource is not found."""

    def __init__(self, message: str = "Resource not found", payload: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=404, payload=payload)


class UnauthorizedError(APIError):
    """Raised when authentication is required or failed."""

    def __init__(
        self, message: str = "Authentication required", payload: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, status_code=401, payload=payload)


class ForbiddenError(APIError):
    """Raised when user doesn't have permission for the action."""

    def __init__(
        self, message: str = "Permission denied", payload: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, status_code=403, payload=payload)


class ConflictError(APIError):
    """Raised when there's a conflict with existing data."""

    def __init__(self, message: str, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=409, payload=payload)


def handle_api_error(error: APIError):
    """
    Handler for APIError exceptions.

    Args:
        error: The APIError instance

    Returns:
        JSON response with error details
    """
    logger.error(
        f"API Error: {error.message} (status={error.status_code}, payload={error.payload})"
    )
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


def handle_http_exception(error: HTTPException):
    """
    Handler for werkzeug HTTPException.

    Args:
        error: The HTTPException instance

    Returns:
        JSON response with error details
    """
    logger.error(f"HTTP Exception: {error.description} (status={error.code})")
    response = jsonify(
        {
            "error": {
                "message": error.description or "An error occurred",
                "code": error.code,
            }
        }
    )
    response.status_code = error.code or 500
    return response


def handle_generic_exception(error: Exception):
    """
    Handler for unexpected exceptions.

    Args:
        error: The exception instance

    Returns:
        JSON response with generic error message
    """
    logger.exception(f"Unexpected error: {str(error)}")
    response = jsonify(
        {
            "error": {
                "message": "An unexpected error occurred. Please try again later.",
                "code": 500,
            }
        }
    )
    response.status_code = 500
    return response


def register_error_handlers(app):
    """
    Register all error handlers with the Flask app.

    Args:
        app: Flask application instance
    """
    app.register_error_handler(APIError, handle_api_error)
    app.register_error_handler(ValidationError, handle_api_error)
    app.register_error_handler(NotFoundError, handle_api_error)
    app.register_error_handler(UnauthorizedError, handle_api_error)
    app.register_error_handler(ForbiddenError, handle_api_error)
    app.register_error_handler(ConflictError, handle_api_error)
    app.register_error_handler(HTTPException, handle_http_exception)
    app.register_error_handler(Exception, handle_generic_exception)

    logger.info("Error handlers registered successfully")
