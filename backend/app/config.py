"""
Configuration constants for the CityForge backend.

This module centralizes all magic numbers and configuration values used
throughout the backend to make them easy to adjust and maintain.
"""


class Config:
    """Configuration values for the Flask backend application."""

    # File upload configuration
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB maximum file size
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

    # Pagination defaults
    DEFAULT_PAGE_SIZE = 20  # Default number of items per page
    MAX_PAGE_SIZE = 100  # Maximum allowed items per page

    # JWT token configuration
    ACCESS_TOKEN_EXPIRES_DAYS = 7  # JWT access token expiration in days

    # Database connection pool (used in app/__init__.py)
    # Production pool sizes
    POOL_SIZE_PRODUCTION = 10  # Maximum connections in pool (production)
    MAX_OVERFLOW_PRODUCTION = 20  # Additional connections beyond pool_size (production)

    # Development pool sizes
    POOL_SIZE_DEVELOPMENT = 5  # Maximum connections in pool (development)
    MAX_OVERFLOW_DEVELOPMENT = 10  # Additional connections beyond pool_size (development)

    # Connection pool timeouts
    POOL_RECYCLE_SECONDS = 3600  # Recycle connections after 1 hour
    POOL_TIMEOUT_SECONDS = 30  # Timeout waiting for connection from pool
