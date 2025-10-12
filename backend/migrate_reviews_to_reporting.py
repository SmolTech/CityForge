"""
Migration script to update Review table from approval-based to reporting-based system.

This migration:
1. Removes approved, approved_by, approved_date columns
2. Adds reported, reported_by, reported_date, reported_reason, hidden columns
3. Migrates existing data (approved reviews become non-hidden, pending reviews become hidden)
"""

from app import create_app, db


def migrate_reviews():
    app = create_app()

    with app.app_context():
        print("Starting review table migration...")

        # Check if migration is needed
        inspector = db.inspect(db.engine)
        columns = [col["name"] for col in inspector.get_columns("reviews")]

        if "reported" in columns:
            print("Migration already completed - reported column exists")
            return

        print("\n=== Migrating Review table structure ===")

        # SQLite doesn't support dropping columns, so we need to recreate the table
        # For PostgreSQL in production, we would use ALTER TABLE commands

        if db.engine.dialect.name == "sqlite":
            # SQLite approach: Create new table, copy data, drop old, rename new
            print("Detected SQLite database - using table recreation approach")

            # Create new table with updated schema
            db.session.execute(
                db.text(
                    """
                CREATE TABLE reviews_new (
                    id INTEGER PRIMARY KEY,
                    card_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    rating INTEGER NOT NULL,
                    title VARCHAR(200),
                    comment TEXT,
                    reported BOOLEAN DEFAULT 0,
                    reported_by INTEGER,
                    reported_date DATETIME,
                    reported_reason TEXT,
                    hidden BOOLEAN DEFAULT 0,
                    created_date DATETIME NOT NULL,
                    updated_date DATETIME NOT NULL,
                    FOREIGN KEY (card_id) REFERENCES cards(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (reported_by) REFERENCES users(id)
                )
            """
                )
            )

            # Copy data from old table to new table
            # Previously approved reviews -> hidden=0, others -> hidden=1
            db.session.execute(
                db.text(
                    """
                INSERT INTO reviews_new (
                    id, card_id, user_id, rating, title, comment,
                    reported, reported_by, reported_date, reported_reason, hidden,
                    created_date, updated_date
                )
                SELECT
                    id, card_id, user_id, rating, title, comment,
                    0 as reported, NULL as reported_by, NULL as reported_date, NULL as reported_reason,
                    CASE WHEN approved = 1 THEN 0 ELSE 1 END as hidden,
                    created_date, updated_date
                FROM reviews
            """
                )
            )

            # Drop old table and rename new table
            db.session.execute(db.text("DROP TABLE reviews"))
            db.session.execute(db.text("ALTER TABLE reviews_new RENAME TO reviews"))

            # Recreate indexes
            db.session.execute(db.text("CREATE INDEX ix_reviews_card_id ON reviews(card_id)"))
            db.session.execute(db.text("CREATE INDEX ix_reviews_user_id ON reviews(user_id)"))
            db.session.execute(db.text("CREATE INDEX ix_reviews_reported ON reviews(reported)"))
            db.session.execute(db.text("CREATE INDEX ix_reviews_hidden ON reviews(hidden)"))
            db.session.execute(
                db.text("CREATE INDEX ix_reviews_created_date ON reviews(created_date)")
            )

            db.session.commit()
            print("SQLite migration completed successfully")

        else:  # PostgreSQL
            print("Detected PostgreSQL database - using ALTER TABLE approach")

            # Add new columns
            db.session.execute(
                db.text("ALTER TABLE reviews ADD COLUMN reported BOOLEAN DEFAULT FALSE NOT NULL")
            )
            db.session.execute(
                db.text("ALTER TABLE reviews ADD COLUMN reported_by INTEGER REFERENCES users(id)")
            )
            db.session.execute(db.text("ALTER TABLE reviews ADD COLUMN reported_date TIMESTAMP"))
            db.session.execute(db.text("ALTER TABLE reviews ADD COLUMN reported_reason TEXT"))
            db.session.execute(
                db.text("ALTER TABLE reviews ADD COLUMN hidden BOOLEAN DEFAULT FALSE NOT NULL")
            )

            # Migrate data: unapproved reviews become hidden
            db.session.execute(db.text("UPDATE reviews SET hidden = TRUE WHERE approved = FALSE"))

            # Drop old columns
            db.session.execute(db.text("ALTER TABLE reviews DROP COLUMN approved"))
            db.session.execute(db.text("ALTER TABLE reviews DROP COLUMN approved_by"))
            db.session.execute(db.text("ALTER TABLE reviews DROP COLUMN approved_date"))

            # Create indexes
            db.session.execute(db.text("CREATE INDEX ix_reviews_reported ON reviews(reported)"))
            db.session.execute(db.text("CREATE INDEX ix_reviews_hidden ON reviews(hidden)"))

            db.session.commit()
            print("PostgreSQL migration completed successfully")

        print("\nMigration completed! Review table has been updated.")
        print("- Removed: approved, approved_by, approved_date")
        print("- Added: reported, reported_by, reported_date, reported_reason, hidden")


if __name__ == "__main__":
    migrate_reviews()
