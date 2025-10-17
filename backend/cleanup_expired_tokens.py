#!/usr/bin/env python3
"""
Cleanup script for expired JWT tokens in the blacklist.

This script removes tokens from the blacklist that have already expired.
Should be run periodically (e.g., daily via cron job).

Usage:
    python cleanup_expired_tokens.py

Cron example (run daily at 2 AM):
    0 2 * * * cd /path/to/backend && python cleanup_expired_tokens.py
"""

from app import create_app
from app.models.token_blacklist import TokenBlacklist


def cleanup_expired_tokens():
    """Remove expired tokens from the blacklist."""
    app = create_app()

    with app.app_context():
        print("Cleaning up expired tokens from blacklist...")

        count = TokenBlacklist.cleanup_expired_tokens()

        print(f"✓ Removed {count} expired token(s) from blacklist")

        # Get current blacklist size
        remaining = TokenBlacklist.query.count()
        print(f"  Current blacklist size: {remaining} token(s)")


if __name__ == "__main__":
    cleanup_expired_tokens()
