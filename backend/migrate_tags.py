#!/usr/bin/env python3
"""
Database migration script to extend tag name column from 50 to 500 characters
"""

import os
import sys
from sqlalchemy import create_engine, text

def migrate_database():
    """Migrate the tags table to allow longer tag names"""

    # Database connection
    postgres_user = os.getenv('POSTGRES_USER', 'postgres')
    postgres_password = os.getenv('POSTGRES_PASSWORD', 'password')
    postgres_host = os.getenv('POSTGRES_HOST', 'localhost')
    postgres_port = os.getenv('POSTGRES_PORT', '5432')
    postgres_db = os.getenv('POSTGRES_DB', 'community')

    database_url = f"postgresql://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_db}"

    try:
        engine = create_engine(database_url)

        with engine.connect() as conn:
            # Check current column length
            result = conn.execute(text("""
                SELECT character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'tags' AND column_name = 'name'
            """))

            current_length = result.fetchone()
            if current_length:
                current_length = current_length[0]
                print(f"Current tag name column length: {current_length}")

                if current_length == 500:
                    print("Tag name column already has correct length (500). No migration needed.")
                    return True

                # Perform the migration
                print("Migrating tags.name column from varchar(50) to varchar(500)...")
                conn.execute(text("ALTER TABLE tags ALTER COLUMN name TYPE VARCHAR(500)"))
                conn.commit()

                print("Migration completed successfully!")
                return True
            else:
                print("Could not find tags.name column. Table may not exist.")
                return False

    except Exception as e:
        print(f"Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = migrate_database()
    sys.exit(0 if success else 1)