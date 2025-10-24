"""
Data management routes for exporting and importing database data.

These endpoints are admin-only and provide web-based access to the
export_data.py and import_data.py functionality.
"""

import json
import logging
from datetime import datetime
from io import BytesIO

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required

from app import db
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
from app.utils.helpers import require_admin

logger = logging.getLogger(__name__)

bp = Blueprint("data_management", __name__)

# Define models and their export order (to handle foreign key dependencies)
EXPORT_ORDER = [
    ("User", User),
    ("Tag", Tag),
    ("Card", Card),
    ("CardSubmission", CardSubmission),
    ("CardModification", CardModification),
    ("Review", Review),
    ("ResourceCategory", ResourceCategory),
    ("ResourceItem", ResourceItem),
    ("QuickAccessItem", QuickAccessItem),
    ("ResourceConfig", ResourceConfig),
    ("ForumCategory", ForumCategory),
    ("ForumCategoryRequest", ForumCategoryRequest),
    ("ForumThread", ForumThread),
    ("ForumPost", ForumPost),
    ("ForumReport", ForumReport),
    ("HelpWantedPost", HelpWantedPost),
    ("HelpWantedComment", HelpWantedComment),
    ("HelpWantedReport", HelpWantedReport),
    ("IndexingJob", IndexingJob),
    ("TokenBlacklist", TokenBlacklist),
]

MODEL_MAP = dict(EXPORT_ORDER)


def serialize_model(instance):
    """Serialize a SQLAlchemy model instance to a dictionary."""
    data = {}
    for column in instance.__table__.columns:
        value = getattr(instance, column.name)
        # Convert datetime to ISO format string
        if isinstance(value, datetime):
            value = value.isoformat()
        data[column.name] = value
    return data


def export_model(model_class):
    """Export all instances of a model to a list of dictionaries."""
    instances = model_class.query.all()
    return [serialize_model(instance) for instance in instances]


def export_many_to_many_relationships():
    """Export many-to-many relationship tables (card_tags)."""
    result = db.session.execute(db.text("SELECT card_id, tag_id FROM card_tags"))
    card_tags = [{"card_id": row[0], "tag_id": row[1]} for row in result]
    return {"card_tags": card_tags}


def deserialize_model(model_class, data):
    """Deserialize a dictionary to a SQLAlchemy model instance."""
    deserialized = {}
    for column in model_class.__table__.columns:
        column_name = column.name
        if column_name in data:
            value = data[column_name]
            # Convert ISO format strings to datetime
            if value and column.type.python_type == datetime and isinstance(value, str):
                try:
                    value = datetime.fromisoformat(value)
                except (ValueError, AttributeError):
                    # Keep original value if conversion fails
                    pass
            deserialized[column_name] = value
    return model_class(**deserialized)


def import_model_skip_mode(model_class, records):
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
    return added, skipped


def import_model_merge_mode(model_class, records):
    """Import records, updating existing and adding new."""
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
    return added, updated


def import_many_to_many_relationships(relationships_data, mode):
    """Import many-to-many relationship tables."""
    card_tags = relationships_data.get("card_tags", [])

    if mode == "clean":
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
    return added, skipped


@bp.route("/api/admin/data/export", methods=["POST"])
@jwt_required()
def export_data():
    """
    Export database data to JSON format.

    Request Body:
        {
            "exclude": ["IndexingJob", "TokenBlacklist"],  // Optional
            "include": ["User", "Card", "Tag"]  // Optional
        }

    Returns:
        JSON file download with all database data
    """
    admin_error = require_admin()
    if admin_error:
        return admin_error

    try:
        data = request.get_json() or {}
        exclude_models = data.get("exclude", [])
        include_models = data.get("include", [])

        logger.info(f"Admin export requested: exclude={exclude_models}, include={include_models}")

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
                continue
            models_to_export.append((model_name, model_class))

        # Export each model
        for model_name, model_class in models_to_export:
            logger.info(f"Exporting {model_name}...")
            export_data_dict["data"][model_name] = export_model(model_class)

        # Export many-to-many relationships
        export_data_dict["relationships"] = export_many_to_many_relationships()

        # Convert to JSON
        json_data = json.dumps(export_data_dict, indent=2, ensure_ascii=False)

        # Create a file-like object
        buffer = BytesIO()
        buffer.write(json_data.encode("utf-8"))
        buffer.seek(0)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"cityforge_export_{timestamp}.json"

        logger.info(
            f"Export complete: {len(json_data)} bytes, {len(export_data_dict['data'])} models"
        )

        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype="application/json",
        )

    except Exception as e:
        logger.error(f"Export failed: {e}", exc_info=True)
        return jsonify({"error": "Export failed", "details": str(e)}), 500


@bp.route("/api/admin/data/import", methods=["POST"])
@jwt_required()
def import_data():
    """
    Import database data from JSON file.

    Request:
        - multipart/form-data with 'file' field containing JSON export
        - Optional 'mode' field: skip (default), merge, or clean
        - Optional 'include' field: comma-separated list of models to import

    Returns:
        JSON with import statistics
    """
    admin_error = require_admin()
    if admin_error:
        return admin_error

    try:
        # Check if file was uploaded
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400

        # Get import mode
        mode = request.form.get("mode", "skip")
        if mode not in ["skip", "merge", "clean"]:
            return jsonify({"error": "Invalid mode. Must be skip, merge, or clean"}), 400

        # Get include list
        include_str = request.form.get("include", "")
        include_models = (
            [m.strip() for m in include_str.split(",") if m.strip()] if include_str else None
        )

        # Validate clean mode (requires explicit confirmation)
        if mode == "clean":
            confirm = request.form.get("confirm", "")
            if confirm != "DELETE ALL DATA":
                return (
                    jsonify(
                        {
                            "error": "Clean mode requires confirmation",
                            "details": "Set 'confirm' field to 'DELETE ALL DATA' to proceed",
                        }
                    ),
                    400,
                )

        logger.info(f"Admin import requested: mode={mode}, include={include_models}")

        # Parse JSON file
        import_data_dict = json.load(file.stream)

        # Validate format
        if "export_metadata" not in import_data_dict or "data" not in import_data_dict:
            return jsonify({"error": "Invalid export file format"}), 400

        metadata = import_data_dict["export_metadata"]
        logger.info(f"Importing export from {metadata.get('timestamp')}")

        data = import_data_dict["data"]

        # Clean mode: delete all data first
        if mode == "clean":
            logger.warning("CLEAN MODE: Deleting all existing data!")
            for model_name, model_class in reversed(EXPORT_ORDER):
                if include_models and model_name not in include_models:
                    continue
                if model_name in data:
                    logger.info(f"Deleting all {model_name} records...")
                    model_class.query.delete()
                    db.session.commit()

            # Clean many-to-many relationships
            db.session.execute(db.text("DELETE FROM card_tags"))
            db.session.commit()

        # Import each model
        stats = {}
        for model_name, model_class in EXPORT_ORDER:
            if include_models and model_name not in include_models:
                continue

            if model_name not in data:
                continue

            logger.info(f"Importing {model_name}...")
            records = data[model_name]

            try:
                if mode == "skip" or mode == "clean":
                    added, skipped = import_model_skip_mode(model_class, records)
                    stats[model_name] = {"added": added, "skipped": skipped}
                elif mode == "merge":
                    added, updated = import_model_merge_mode(model_class, records)
                    stats[model_name] = {"added": added, "updated": updated}
            except Exception as e:
                logger.error(f"Error importing {model_name}: {e}")
                db.session.rollback()
                raise

        # Import relationships
        if "relationships" in import_data_dict:
            logger.info("Importing many-to-many relationships...")
            rel_added, rel_skipped = import_many_to_many_relationships(
                import_data_dict["relationships"], mode
            )
            stats["relationships"] = {"added": rel_added, "skipped": rel_skipped}

        logger.info(f"Import complete: {stats}")

        return jsonify(
            {
                "success": True,
                "message": "Import completed successfully",
                "stats": stats,
                "metadata": metadata,
            }
        )

    except Exception as e:
        logger.error(f"Import failed: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Import failed", "details": str(e)}), 500


@bp.route("/api/admin/data/models", methods=["GET"])
@jwt_required()
def get_available_models():
    """
    Get list of available models for export/import.

    Returns:
        JSON array of model names and their record counts
    """
    admin_error = require_admin()
    if admin_error:
        return admin_error

    try:
        models = []
        for model_name, model_class in EXPORT_ORDER:
            count = model_class.query.count()
            models.append(
                {
                    "name": model_name,
                    "count": count,
                }
            )

        return jsonify({"models": models})

    except Exception as e:
        logger.error(f"Failed to get models: {e}", exc_info=True)
        return jsonify({"error": "Failed to get models", "details": str(e)}), 500
