#!/usr/bin/env python3
"""
Migration script to create the token_blacklist table.

This script should be run once to add the token blacklist table to the database.
After Flask-Migrate is added (issue #19), this script won't be needed.
"""

from app import create_app, db
from app.models.token_blacklist import TokenBlacklist


def create_token_blacklist_table():
    """Create the token_blacklist table."""
    app = create_app()

    with app.app_context():
        print("Creating token_blacklist table...")

        # Create only the token_blacklist table
        TokenBlacklist.__table__.create(db.engine, checkfirst=True)

        print("✓ Token blacklist table created successfully!")
        print("\nTable schema:")
        print("  - id: Primary key")
        print("  - jti: JWT token ID (unique, indexed)")
        print("  - token_type: 'access' or 'refresh'")
        print("  - user_id: Foreign key to users table")
        print("  - revoked_at: Timestamp when token was revoked")
        print("  - expires_at: Token expiration timestamp")


if __name__ == "__main__":
    create_token_blacklist_table()
