#!/usr/bin/env python3
"""
Migration script to add Help Wanted feature tables.

This script adds:
- help_wanted_posts table
- help_wanted_comments table
- help_wanted_reports table

Safe to run multiple times - checks for existing tables before creating.
"""

import os
import sys

from sqlalchemy import inspect

from app import create_app, db
from app.models.help_wanted import HelpWantedComment, HelpWantedPost, HelpWantedReport

# Create app instance
app = create_app()


def table_exists(table_name):
    """Check if a table exists in the database."""
    inspector = inspect(db.engine)
    return table_name in inspector.get_table_names()


def migrate():
    """Run the migration."""
    with app.app_context():
        print("Checking for existing Help Wanted tables...")

        tables_to_create = []

        if not table_exists("help_wanted_posts"):
            tables_to_create.append("help_wanted_posts")
        else:
            print("✓ help_wanted_posts table already exists")

        if not table_exists("help_wanted_comments"):
            tables_to_create.append("help_wanted_comments")
        else:
            print("✓ help_wanted_comments table already exists")

        if not table_exists("help_wanted_reports"):
            tables_to_create.append("help_wanted_reports")
        else:
            print("✓ help_wanted_reports table already exists")

        if not tables_to_create:
            print("\n✓ All Help Wanted tables already exist. No migration needed.")
            return

        print(f"\nCreating tables: {', '.join(tables_to_create)}")

        # Create only the Help Wanted tables
        with db.engine.begin() as conn:
            if "help_wanted_posts" in tables_to_create:
                HelpWantedPost.__table__.create(conn, checkfirst=True)
                print("✓ Created help_wanted_posts table")

            if "help_wanted_comments" in tables_to_create:
                HelpWantedComment.__table__.create(conn, checkfirst=True)
                print("✓ Created help_wanted_comments table")

            if "help_wanted_reports" in tables_to_create:
                HelpWantedReport.__table__.create(conn, checkfirst=True)
                print("✓ Created help_wanted_reports table")

        print("\n✓ Migration completed successfully!")


if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"\n✗ Migration failed: {e}", file=sys.stderr)
        sys.exit(1)
