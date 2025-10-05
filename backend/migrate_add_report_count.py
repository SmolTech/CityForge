#!/usr/bin/env python3
"""
Migration script to add report_count column to help_wanted_posts table.
Run this with: python migrate_add_report_count.py
"""

from sqlalchemy import text

from app import create_app, db


def migrate():
    app = create_app()

    with app.app_context():
        try:
            # Check if column already exists
            from sqlalchemy import inspect

            inspector = inspect(db.engine)

            # Check if table exists
            if "help_wanted_posts" not in inspector.get_table_names():
                print("ERROR: help_wanted_posts table doesn't exist. Run init_db.py first.")
                return False

            columns = inspector.get_columns("help_wanted_posts")
            col_names = [c["name"] for c in columns]

            if "report_count" in col_names:
                print("✓ report_count column already exists - no migration needed")
                return True

            # Add the column
            print("Adding report_count column to help_wanted_posts...")
            db.session.execute(
                text(
                    "ALTER TABLE help_wanted_posts ADD COLUMN report_count INTEGER DEFAULT 0 NOT NULL"
                )
            )
            db.session.commit()
            print("✓ Successfully added report_count column")
            print("✓ Migration completed successfully!")
            return True

        except Exception as e:
            print(f"ERROR during migration: {e}")
            db.session.rollback()
            return False


if __name__ == "__main__":
    success = migrate()
    exit(0 if success else 1)
