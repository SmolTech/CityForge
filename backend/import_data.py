#!/usr/bin/env python3
"""
Import CityForge database from JSON format.

This script imports data from a JSON export file into the CityForge database.
Supports various import modes to handle existing data.

Usage:
    python import_data.py --input FILE [--mode MODE] [--include MODEL1,MODEL2,...]

Import Modes:
    - skip: Skip records that already exist (default, safest)
    - replace: Replace existing records with imported data
    - merge: Update existing records, add new ones
    - clean: Delete all existing data before import (DESTRUCTIVE!)

Examples:
    # Import from backup file, skipping existing records
    python import_data.py --input backup.json

    # Replace all existing data with backup (DESTRUCTIVE!)
    python import_data.py --input backup.json --mode clean

    # Merge data, updating existing records
    python import_data.py --input backup.json --mode merge

    # Import only specific models
    python import_data.py --input backup.json --include User,Card,Tag
"""

import argparse
import json
import logging
import sys
from datetime import datetime

from app import create_app, db
from app.models import (
    Card,
    CardModification,
    CardSubmission,
    ForumCategory,
    ForumCategoryRequest,
    ForumPost,
    ForumReport,
    ForumThread,
    HelpWantedComment,
    HelpWantedPost,
    HelpWantedReport,
    IndexingJob,
    QuickAccessItem,
    ResourceCategory,
    ResourceConfig,
    ResourceItem,
    Review,
    Tag,
    User,
)
from app.models.token_blacklist import TokenBlacklist

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Define models in import order (respects foreign key dependencies)
IMPORT_ORDER = [
    # Users first (referenced by many tables)
    ("User", User),
    # Tags (referenced by cards via many-to-many)
    ("Tag", Tag),
    # Cards (referenced by submissions, modifications, reviews)
    ("Card", Card),
    # Card-related (depend on Card and User)
    ("CardSubmission", CardSubmission),
    ("CardModification", CardModification),
    ("Review", Review),
    # Resources
    ("ResourceCategory", ResourceCategory),
    ("ResourceItem", ResourceItem),
    ("QuickAccessItem", QuickAccessItem),
    ("ResourceConfig", ResourceConfig),
    # Forums (depend on User and ForumCategory)
    ("ForumCategory", ForumCategory),
    ("ForumCategoryRequest", ForumCategoryRequest),
    ("ForumThread", ForumThread),
    ("ForumPost", ForumPost),
    ("ForumReport", ForumReport),
    # Help Wanted / Classifieds
    ("HelpWantedPost", HelpWantedPost),
    ("HelpWantedComment", HelpWantedComment),
    ("HelpWantedReport", HelpWantedReport),
    # Operational data
    ("IndexingJob", IndexingJob),
    ("TokenBlacklist", TokenBlacklist),
]

# Map model names to classes
MODEL_MAP = {name: cls for name, cls in IMPORT_ORDER}


def deserialize_model(model_class, data):
    """
    Deserialize a dictionary to a SQLAlchemy model instance.

    Converts ISO format datetime strings back to datetime objects.
    """
    deserialized = {}
    for column in model_class.__table__.columns:
        column_name = column.name
        if column_name in data:
            value = data[column_name]
            # Convert ISO format strings to datetime
            if value and column.type.python_type == datetime:
                try:
                    value = datetime.fromisoformat(value)
                except (ValueError, AttributeError):
                    pass
            deserialized[column_name] = value
    return model_class(**deserialized)


def clean_table(model_class, model_name):
    """Delete all records from a table."""
    logger.warning(f"  Deleting all {model_name} records...")
    count = model_class.query.delete()
    db.session.commit()
    logger.warning(f"  Deleted {count} records")


def import_model_skip_mode(model_class, model_name, records):
    """Import records, skipping those that already exist."""
    added = 0
    skipped = 0

    for record_data in records:
        # Check if record exists by primary key
        pk_column = model_class.__table__.primary_key.columns.values()[0]
        pk_value = record_data.get(pk_column.name)

        if pk_value and model_class.query.get(pk_value):
            skipped += 1
            continue

        # Add new record
        instance = deserialize_model(model_class, record_data)
        db.session.add(instance)
        added += 1

    db.session.commit()
    logger.info(f"  Added {added} records, skipped {skipped} existing")
    return added, skipped


def import_model_replace_mode(model_class, model_name, records):
    """Import records, replacing those that already exist."""
    added = 0
    updated = 0

    for record_data in records:
        # Check if record exists by primary key
        pk_column = model_class.__table__.primary_key.columns.values()[0]
        pk_value = record_data.get(pk_column.name)

        existing = model_class.query.get(pk_value) if pk_value else None

        if existing:
            # Update existing record
            for key, value in record_data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            updated += 1
        else:
            # Add new record
            instance = deserialize_model(model_class, record_data)
            db.session.add(instance)
            added += 1

    db.session.commit()
    logger.info(f"  Added {added} records, updated {updated} existing")
    return added, updated


def import_model_merge_mode(model_class, model_name, records):
    """Import records, updating existing and adding new."""
    return import_model_replace_mode(model_class, model_name, records)


def import_many_to_many_relationships(relationships_data, mode):
    """Import many-to-many relationship tables."""
    logger.info("Importing many-to-many relationships...")

    # Import card_tags
    card_tags = relationships_data.get("card_tags", [])

    if mode == "clean":
        logger.warning("  Deleting all card_tags relationships...")
        db.session.execute(db.text("DELETE FROM card_tags"))
        db.session.commit()

    added = 0
    skipped = 0

    for relationship in card_tags:
        card_id = relationship["card_id"]
        tag_id = relationship["tag_id"]

        # Check if relationship exists
        existing = db.session.execute(
            db.text("SELECT 1 FROM card_tags WHERE card_id = :card_id AND tag_id = :tag_id"),
            {"card_id": card_id, "tag_id": tag_id},
        ).fetchone()

        if existing and mode == "skip":
            skipped += 1
            continue

        if not existing:
            db.session.execute(
                db.text("INSERT INTO card_tags (card_id, tag_id) VALUES (:card_id, :tag_id)"),
                {"card_id": card_id, "tag_id": tag_id},
            )
            added += 1

    db.session.commit()
    logger.info(f"  Added {added} relationships, skipped {skipped} existing")


def import_data(input_file, mode="skip", include_models=None):
    """
    Import database data from a JSON file.

    Args:
        input_file: Path to input JSON file
        mode: Import mode (skip, replace, merge, clean)
        include_models: List of model names to import (if specified, only these are imported)
    """
    app = create_app()

    with app.app_context():
        logger.info("Starting database import...")
        logger.info(f"Input file: {input_file}")
        logger.info(f"Import mode: {mode}")

        # Load JSON data
        logger.info("Loading JSON data...")
        with open(input_file, encoding="utf-8") as f:
            import_data_dict = json.load(f)

        # Validate format
        if "export_metadata" not in import_data_dict or "data" not in import_data_dict:
            logger.error("Invalid export file format")
            sys.exit(1)

        metadata = import_data_dict["export_metadata"]
        logger.info(f"Export timestamp: {metadata.get('timestamp')}")
        logger.info(f"Export version: {metadata.get('version')}")

        data = import_data_dict["data"]

        # Clean mode: delete all data first
        if mode == "clean":
            logger.warning("⚠ CLEAN MODE: Deleting all existing data!")
            logger.warning("This operation cannot be undone.")
            response = input("Type 'DELETE ALL DATA' to confirm: ")
            if response != "DELETE ALL DATA":
                logger.info("Import cancelled")
                sys.exit(0)

            # Delete in reverse order to respect foreign keys
            for model_name, model_class in reversed(IMPORT_ORDER):
                if include_models and model_name not in include_models:
                    continue
                if model_name in data:
                    clean_table(model_class, model_name)

            # Clean many-to-many relationships
            logger.warning("  Deleting all many-to-many relationships...")
            db.session.execute(db.text("DELETE FROM card_tags"))
            db.session.commit()

        # Import each model
        stats = {}
        for model_name, model_class in IMPORT_ORDER:
            if include_models and model_name not in include_models:
                continue

            if model_name not in data:
                logger.info(f"Skipping {model_name} (not in export)")
                continue

            logger.info(f"Importing {model_name}...")
            records = data[model_name]

            try:
                if mode == "skip":
                    added, skipped = import_model_skip_mode(model_class, model_name, records)
                    stats[model_name] = {"added": added, "skipped": skipped}
                elif mode in ("replace", "merge"):
                    added, updated = import_model_merge_mode(model_class, model_name, records)
                    stats[model_name] = {"added": added, "updated": updated}
                elif mode == "clean":
                    # In clean mode, all records are new
                    added, _ = import_model_skip_mode(model_class, model_name, records)
                    stats[model_name] = {"added": added}
            except Exception as e:
                logger.error(f"Error importing {model_name}: {e}")
                db.session.rollback()
                raise

        # Import relationships
        if "relationships" in import_data_dict:
            try:
                import_many_to_many_relationships(import_data_dict["relationships"], mode)
            except Exception as e:
                logger.error(f"Error importing relationships: {e}")
                db.session.rollback()
                raise

        logger.info("✓ Import complete!")
        logger.info("Summary:")
        for model_name, model_stats in stats.items():
            logger.info(f"  {model_name}: {model_stats}")


def main():
    parser = argparse.ArgumentParser(
        description="Import CityForge database from JSON format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Import Modes:
  skip    - Skip records that already exist (default, safest)
  replace - Replace existing records with imported data
  merge   - Update existing records, add new ones (same as replace)
  clean   - Delete all existing data before import (DESTRUCTIVE!)

Examples:
  # Import from backup, skipping existing records
  python import_data.py --input backup.json

  # Replace all data with backup (DESTRUCTIVE!)
  python import_data.py --input backup.json --mode clean

  # Merge data, updating existing
  python import_data.py --input backup.json --mode merge

  # Import only users and cards
  python import_data.py --input backup.json --include User,Card,Tag
        """,
    )

    parser.add_argument(
        "--input",
        "-i",
        help="Input JSON file path",
        required=True,
    )

    parser.add_argument(
        "--mode",
        "-m",
        help="Import mode (skip, replace, merge, clean)",
        choices=["skip", "replace", "merge", "clean"],
        default="skip",
    )

    parser.add_argument(
        "--include",
        help="Comma-separated list of models to import (if specified, only these are imported)",
        default=None,
    )

    args = parser.parse_args()

    # Parse include list
    include_models = args.include.split(",") if args.include else None

    try:
        import_data(args.input, args.mode, include_models)
    except Exception as e:
        logger.error(f"Import failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
