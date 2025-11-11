#!/usr/bin/env python3
"""
Export CityForge database to JSON format.

This script exports all data from the CityForge database into a JSON file
that can be imported into another instance or used for backup purposes.

Usage:
    python export_data.py [--output FILE] [--exclude MODEL1,MODEL2,...]

Examples:
    # Export all data to default file (data_export_YYYYMMDD_HHMMSS.json)
    python export_data.py

    # Export to specific file
    python export_data.py --output backup.json

    # Export excluding certain models
    python export_data.py --exclude IndexingJob,TokenBlacklist

    # Export only specific models
    python export_data.py --include User,Card,Tag
"""

import argparse
import json
import logging
import os
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

# Define models and their export order (to handle foreign key dependencies)
EXPORT_ORDER = [
    # Users first (referenced by many tables)
    ("User", User),
    # Tags (referenced by cards)
    ("Tag", Tag),
    # Cards (referenced by submissions, modifications, reviews)
    ("Card", Card),
    # Card-related
    ("CardSubmission", CardSubmission),
    ("CardModification", CardModification),
    ("Review", Review),
    # Resources
    ("ResourceCategory", ResourceCategory),
    ("ResourceItem", ResourceItem),
    ("QuickAccessItem", QuickAccessItem),
    ("ResourceConfig", ResourceConfig),
    # Forums
    ("ForumCategory", ForumCategory),
    ("ForumCategoryRequest", ForumCategoryRequest),
    ("ForumThread", ForumThread),
    ("ForumPost", ForumPost),
    ("ForumReport", ForumReport),
    # Help Wanted / Classifieds
    ("HelpWantedPost", HelpWantedPost),
    ("HelpWantedComment", HelpWantedComment),
    ("HelpWantedReport", HelpWantedReport),
    # Operational data (usually excluded)
    ("IndexingJob", IndexingJob),
    ("TokenBlacklist", TokenBlacklist),
]


def serialize_model(instance):
    """
    Serialize a SQLAlchemy model instance to a dictionary.

    Handles datetime objects and excludes internal SQLAlchemy attributes.
    """
    data = {}
    for column in instance.__table__.columns:
        value = getattr(instance, column.name)
        # Convert datetime to ISO format string
        if isinstance(value, datetime):
            value = value.isoformat()
        data[column.name] = value
    return data


def export_model(model_class, model_name):
    """Export all instances of a model to a list of dictionaries."""
    logger.info(f"Exporting {model_name}...")
    instances = model_class.query.all()
    data = [serialize_model(instance) for instance in instances]
    logger.info(f"  Exported {len(data)} {model_name} records")
    return data


def export_many_to_many_relationships():
    """Export many-to-many relationship tables (card_tags)."""
    logger.info("Exporting many-to-many relationships...")

    # card_tags relationship
    result = db.session.execute(db.text("SELECT card_id, tag_id FROM card_tags"))
    card_tags = [{"card_id": row[0], "tag_id": row[1]} for row in result]
    logger.info(f"  Exported {len(card_tags)} card_tags relationships")

    return {"card_tags": card_tags}


def export_data(output_file, exclude_models=None, include_models=None):
    """
    Export all database data to a JSON file.

    Args:
        output_file: Path to output JSON file
        exclude_models: List of model names to exclude from export
        include_models: List of model names to include (if specified, only these are exported)
    """
    app = create_app()

    with app.app_context():
        logger.info("Starting database export...")
        logger.info(f"Output file: {output_file}")

        export_data_dict = {
            "export_metadata": {
                "timestamp": datetime.utcnow().isoformat(),
                "version": "1.0",
                "database": "cityforge",
            },
            "data": {},
        }

        # Determine which models to export
        models_to_export = []
        for model_name, model_class in EXPORT_ORDER:
            if include_models and model_name not in include_models:
                continue
            if exclude_models and model_name in exclude_models:
                logger.info(f"Skipping {model_name} (excluded)")
                continue
            models_to_export.append((model_name, model_class))

        # Export each model
        for model_name, model_class in models_to_export:
            try:
                export_data_dict["data"][model_name] = export_model(model_class, model_name)
            except Exception as e:
                logger.error(f"Error exporting {model_name}: {e}")
                raise

        # Export many-to-many relationships
        try:
            relationships = export_many_to_many_relationships()
            export_data_dict["relationships"] = relationships
        except Exception as e:
            logger.error(f"Error exporting relationships: {e}")
            raise

        # Write to file
        logger.info(f"Writing export to {output_file}...")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(export_data_dict, f, indent=2, ensure_ascii=False)

        # Calculate file size
        file_size = os.path.getsize(output_file)
        file_size_mb = file_size / (1024 * 1024)

        logger.info("✓ Export complete!")
        logger.info(f"  File: {output_file}")
        logger.info(f"  Size: {file_size_mb:.2f} MB")
        logger.info(f"  Models exported: {len(export_data_dict['data'])}")

        # Summary
        total_records = sum(len(records) for records in export_data_dict["data"].values())
        logger.info(f"  Total records: {total_records}")


def main():
    parser = argparse.ArgumentParser(
        description="Export CityForge database to JSON format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Export all data to default timestamped file
  python export_data.py

  # Export to specific file
  python export_data.py --output backup.json

  # Export excluding operational data
  python export_data.py --exclude IndexingJob,TokenBlacklist

  # Export only users and cards
  python export_data.py --include User,Card,Tag
        """,
    )

    parser.add_argument(
        "--output",
        "-o",
        help="Output file path (default: data_export_YYYYMMDD_HHMMSS.json)",
        default=None,
    )

    parser.add_argument(
        "--exclude",
        "-e",
        help="Comma-separated list of models to exclude from export",
        default=None,
    )

    parser.add_argument(
        "--include",
        "-i",
        help="Comma-separated list of models to include (if specified, only these are exported)",
        default=None,
    )

    args = parser.parse_args()

    # Generate default output filename with timestamp
    if args.output is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"data_export_{timestamp}.json"

    # Parse exclude/include lists
    exclude_models = args.exclude.split(",") if args.exclude else None
    include_models = args.include.split(",") if args.include else None

    if exclude_models and include_models:
        logger.error("Cannot specify both --exclude and --include")
        sys.exit(1)

    try:
        export_data(args.output, exclude_models, include_models)
    except Exception as e:
        logger.error(f"Export failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
