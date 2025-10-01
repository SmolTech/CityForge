#!/usr/bin/env python3
"""
Database migration script to add address_override_url column to existing tables.

This script adds the address_override_url column to:
- cards
- card_submissions
- card_modifications

Run this script to update the database schema after deploying the new code.
"""

import os
import psycopg3
from psycopg3.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def get_database_connection():
    """Get database connection from environment variables."""
    db_user = os.getenv('POSTGRES_USER', 'postgres')
    db_password = os.getenv('POSTGRES_PASSWORD', 'postgres')
    db_host = os.getenv('POSTGRES_HOST', 'localhost')
    db_port = os.getenv('POSTGRES_PORT', '5432')
    db_name = os.getenv('POSTGRES_DB', 'community_db')

    return psycopg3.connect(
        host=db_host,
        port=db_port,
        database=db_name,
        user=db_user,
        password=db_password
    )

def column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table."""
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
        );
    """, (table_name, column_name))
    return cursor.fetchone()[0]

def add_address_override_column(cursor, table_name):
    """Add address_override_url column to a table if it doesn't exist."""
    # Validate table name to prevent SQL injection
    allowed_tables = ['cards', 'card_submissions', 'card_modifications']
    if table_name not in allowed_tables:
        raise ValueError(f"Invalid table name: {table_name}")

    if not column_exists(cursor, table_name, 'address_override_url'):
        print(f"Adding address_override_url column to {table_name} table...")
        # Safe to use f-string here since table_name is validated against whitelist
        # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query, python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
        cursor.execute(f"""
            ALTER TABLE {table_name}
            ADD COLUMN address_override_url VARCHAR(500);
        """)
        print(f"✓ Added address_override_url column to {table_name}")
    else:
        print(f"✓ Column address_override_url already exists in {table_name}")

def main():
    """Main migration function."""
    print("Starting database migration for address_override_url column...")

    try:
        # Connect to database
        conn = get_database_connection()
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        print("Connected to database successfully")

        # Tables that need the new column
        tables = ['cards', 'card_submissions', 'card_modifications']

        # Add column to each table
        for table in tables:
            add_address_override_column(cursor, table)

        print("\n✅ Migration completed successfully!")
        print("The address_override_url column has been added to all required tables.")
        print("You can now restart the backend service.")

    except psycopg3.Error as e:
        print(f"❌ Database error: {e}")
        return 1
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return 1
    finally:
        if 'conn' in locals():
            conn.close()

    return 0

if __name__ == "__main__":
    exit(main())
