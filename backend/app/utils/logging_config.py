"""
Logging configuration for the CityForge backend.

This module configures structured logging for the application.
"""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler


def configure_logging(app):
    """
    Configure logging for the Flask application.

    Args:
        app: Flask application instance
    """
    # Get log level from environment or default to INFO
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

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
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5  # 10MB
        )
        file_handler.setLevel(log_level)
        file_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(pathname)s:%(lineno)d - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)

        app.logger.info(f"File logging enabled: {log_file}")

    # Set Flask app logger level
    app.logger.setLevel(log_level)

    # Log configuration
    app.logger.info(f"Logging configured with level: {log_level_name}")

    # Silence noisy loggers
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
