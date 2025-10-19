"""
Logging configuration for the CityForge backend.

This module configures structured logging for the application with:
- JSON formatting for production environments
- Human-readable formatting for development
- Rotating file handlers
- Environment-based log levels
"""

import json
import logging
import os
import sys
from datetime import UTC, datetime
from logging.handlers import RotatingFileHandler


class JSONFormatter(logging.Formatter):
    """Format log records as JSON for structured logging."""

    def format(self, record):
        """Format a log record as a JSON string."""
        log_data = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields if present
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id

        return json.dumps(log_data)


def configure_logging(app):
    """
    Configure logging for the Flask application.

    Log levels by environment (can be overridden with LOG_LEVEL env var):
    - Development: DEBUG
    - Staging: INFO
    - Production: WARNING

    Args:
        app: Flask application instance
    """
    # Determine environment
    flask_env = os.getenv("FLASK_ENV", "development").lower()

    # Get log level from environment or use environment-based defaults
    log_level_name = os.getenv("LOG_LEVEL")
    if log_level_name:
        log_level = getattr(logging, log_level_name.upper(), logging.INFO)
    else:
        # Environment-based defaults
        if flask_env == "production":
            log_level = logging.WARNING
        elif flask_env == "staging":
            log_level = logging.INFO
        else:  # development
            log_level = logging.DEBUG

    # Create logs directory if it doesn't exist
    log_dir = os.getenv("LOG_DIR", "logs")
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    # Use JSON format in production/staging, readable format in development
    if flask_env in ("production", "staging"):
        console_handler.setFormatter(JSONFormatter())
    else:
        console_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(console_formatter)

    root_logger.addHandler(console_handler)

    # File handler (if log directory is configured)
    if log_dir:
        log_file = os.path.join(log_dir, "cityforge.log")
        file_handler = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=10  # 10MB, 10 backups
        )
        file_handler.setLevel(log_level)

        # Always use JSON format for file logs (easier to parse)
        file_handler.setFormatter(JSONFormatter())
        root_logger.addHandler(file_handler)

        app.logger.info(f"File logging enabled: {log_file}")

    # Set Flask app logger level
    app.logger.setLevel(log_level)

    # Log configuration
    app.logger.info(
        f"Logging configured: level={logging.getLevelName(log_level)}, env={flask_env}"
    )

    # Silence noisy loggers
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
