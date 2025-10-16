from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, text

from app import db
from app.models.card import Card, CardModification, CardSubmission, Tag, card_tags
from app.models.forum import (
    ForumCategory,
    ForumCategoryRequest,
    ForumPost,
    ForumReport,
    ForumThread,
)
from app.models.help_wanted import HelpWantedPost, HelpWantedReport
from app.models.resource import QuickAccessItem, ResourceConfig, ResourceItem
from app.models.review import Review
from app.models.user import User
from app.utils.helpers import generate_slug, require_admin

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# Card Management
@bp.route("/cards", methods=["GET"])
@jwt_required()
def admin_get_cards():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    search = request.args.get("search", "").strip()
    status = request.args.get("status")
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = Card.query

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                Card.name.ilike(search_term),
                Card.description.ilike(search_term),
                Card.address.ilike(search_term),
                Card.contact_name.ilike(search_term),
            )
        )

    if status == "approved":
        query = query.filter_by(approved=True)
    elif status == "pending":
        query = query.filter_by(approved=False)

    total_count = query.count()
    cards = query.order_by(Card.created_date.desc()).offset(offset).limit(limit).all()

    return jsonify(
        {
            "cards": [card.to_dict() for card in cards],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/cards", methods=["POST"])
@jwt_required()
def admin_create_card():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not all(k in data for k in ["name"]):
        return jsonify({"message": "Missing required fields"}), 400

    card = Card(
        name=data["name"],
        description=data.get("description", ""),
        website_url=data.get("website_url"),
        phone_number=data.get("phone_number"),
        email=data.get("email"),
        address=data.get("address"),
        contact_name=data.get("contact_name"),
        image_url=data.get("image_url"),
        featured=data.get("featured", False),
        approved=True,
        created_by=user_id,
        approved_by=user_id,
        approved_date=datetime.utcnow(),
    )

    if "tags" in data:
        for tag_name in data["tags"]:
            tag = Tag.query.filter_by(name=tag_name.strip().lower()).first()
            if not tag:
                tag = Tag(name=tag_name.strip().lower())
                db.session.add(tag)
            card.tags.append(tag)

    db.session.add(card)
    db.session.commit()

    return jsonify(card.to_dict()), 201


@bp.route("/cards/<int:card_id>", methods=["PUT"])
@jwt_required()
def admin_update_card(card_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    card = Card.query.get_or_404(card_id)
    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    for field in [
        "name",
        "description",
        "website_url",
        "phone_number",
        "email",
        "address",
        "address_override_url",
        "contact_name",
        "image_url",
        "featured",
        "approved",
    ]:
        if field in data:
            setattr(card, field, data[field])

    if "tags" in data:
        card.tags.clear()
        for tag_name in data["tags"]:
            tag = Tag.query.filter_by(name=tag_name.strip().lower()).first()
            if not tag:
                tag = Tag(name=tag_name.strip().lower())
                db.session.add(tag)
            card.tags.append(tag)

    card.updated_date = datetime.utcnow()
    db.session.commit()

    return jsonify(card.to_dict())


@bp.route("/cards/<int:card_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_card(card_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    card = Card.query.get_or_404(card_id)
    CardModification.query.filter_by(card_id=card_id).delete()
    db.session.delete(card)
    db.session.commit()

    return jsonify({"message": "Card deleted successfully"})


# Submission Management
@bp.route("/submissions", methods=["GET"])
@jwt_required()
def admin_get_submissions():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    status = request.args.get("status", "pending")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = CardSubmission.query

    if status != "all":
        query = query.filter_by(status=status)

    total_count = query.count()
    submissions = (
        query.order_by(CardSubmission.created_date.desc()).offset(offset).limit(limit).all()
    )

    return jsonify(
        {
            "submissions": [submission.to_dict() for submission in submissions],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/submissions/<int:submission_id>/approve", methods=["POST"])
@jwt_required()
def admin_approve_submission(submission_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    submission = CardSubmission.query.get_or_404(submission_id)
    data = request.get_json() or {}

    if submission.status != "pending":
        return jsonify({"message": "Submission already reviewed"}), 400

    card = Card(
        name=submission.name,
        description=submission.description,
        website_url=submission.website_url,
        phone_number=submission.phone_number,
        email=submission.email,
        address=submission.address,
        address_override_url=submission.address_override_url,
        contact_name=submission.contact_name,
        image_url=submission.image_url,
        featured=data.get("featured", False),
        approved=True,
        created_by=submission.submitted_by,
        approved_by=user_id,
        approved_date=datetime.utcnow(),
    )

    if submission.tags_text:
        tag_names = [tag.strip().lower() for tag in submission.tags_text.split(",") if tag.strip()]
        for tag_name in tag_names:
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.session.add(tag)
            card.tags.append(tag)

    db.session.add(card)

    submission.status = "approved"
    submission.reviewed_by = user_id
    submission.reviewed_date = datetime.utcnow()
    submission.review_notes = data.get("notes", "")
    submission.card_id = card.id

    db.session.commit()

    return jsonify(
        {
            "message": "Submission approved",
            "card": card.to_dict(),
            "submission": submission.to_dict(),
        }
    )


@bp.route("/submissions/<int:submission_id>/reject", methods=["POST"])
@jwt_required()
def admin_reject_submission(submission_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    submission = CardSubmission.query.get_or_404(submission_id)
    data = request.get_json() or {}

    if submission.status != "pending":
        return jsonify({"message": "Submission already reviewed"}), 400

    submission.status = "rejected"
    submission.reviewed_by = user_id
    submission.reviewed_date = datetime.utcnow()
    submission.review_notes = data.get("notes", "")

    db.session.commit()

    return jsonify({"message": "Submission rejected", "submission": submission.to_dict()})


# Modification Management
@bp.route("/modifications", methods=["GET"])
@jwt_required()
def admin_get_modifications():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    status = request.args.get("status", "pending")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = CardModification.query

    if status != "all":
        query = query.filter_by(status=status)

    total = query.count()
    modifications = (
        query.order_by(CardModification.created_date.desc()).offset(offset).limit(limit).all()
    )

    return jsonify(
        {
            "modifications": [mod.to_dict() for mod in modifications],
            "total": total,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/modifications/<int:modification_id>/approve", methods=["POST"])
@jwt_required()
def admin_approve_modification(modification_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    modification = CardModification.query.get_or_404(modification_id)

    if modification.status != "pending":
        return jsonify({"message": "Modification already reviewed"}), 400

    card = modification.card
    card.name = modification.name
    card.description = modification.description
    card.website_url = modification.website_url
    card.phone_number = modification.phone_number
    card.email = modification.email
    card.address = modification.address
    card.address_override_url = modification.address_override_url
    card.contact_name = modification.contact_name
    card.image_url = modification.image_url
    card.updated_date = datetime.utcnow()

    card.tags.clear()
    if modification.tags_text:
        tag_names = [
            tag.strip().lower() for tag in modification.tags_text.split(",") if tag.strip()
        ]
        for tag_name in tag_names:
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.session.add(tag)
            card.tags.append(tag)

    modification.status = "approved"
    modification.reviewed_by = user_id
    modification.reviewed_date = datetime.utcnow()

    db.session.commit()

    return jsonify(
        {
            "message": "Modification approved and applied",
            "modification": modification.to_dict(),
            "card": card.to_dict(),
        }
    )


@bp.route("/modifications/<int:modification_id>/reject", methods=["POST"])
@jwt_required()
def admin_reject_modification(modification_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    modification = CardModification.query.get_or_404(modification_id)
    data = request.get_json() or {}

    if modification.status != "pending":
        return jsonify({"message": "Modification already reviewed"}), 400

    modification.status = "rejected"
    modification.reviewed_by = user_id
    modification.reviewed_date = datetime.utcnow()
    modification.review_notes = data.get("notes", "")

    db.session.commit()

    return jsonify({"message": "Modification rejected", "modification": modification.to_dict()})


# User Management
@bp.route("/users", methods=["GET"])
@jwt_required()
def admin_get_users():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    search = request.args.get("search", "", type=str)

    query = User.query

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            db.or_(
                User.email.ilike(search_filter),
                User.first_name.ilike(search_filter),
                User.last_name.ilike(search_filter),
            )
        )

    total = query.count()
    users = query.order_by(User.created_date.desc()).offset((page - 1) * limit).limit(limit).all()

    return jsonify(
        {"users": [user.to_dict() for user in users], "total": total, "page": page, "limit": limit}
    )


@bp.route("/users/<int:user_id>", methods=["PUT"])
@jwt_required()
def admin_update_user(user_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    current_user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    if user_id == int(current_user_id) and "role" in data and data["role"] != "admin":
        return jsonify({"message": "Cannot demote yourself from admin"}), 400

    if "first_name" in data:
        user.first_name = data["first_name"]
    if "last_name" in data:
        user.last_name = data["last_name"]
    if "role" in data and data["role"] in ["admin", "user"]:
        user.role = data["role"]
    if "is_active" in data:
        user.is_active = data["is_active"]

    db.session.commit()

    return jsonify(user.to_dict())


@bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_user(user_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    current_user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)

    if user_id == int(current_user_id):
        return jsonify({"message": "Cannot delete yourself"}), 400

    submissions_count = db.session.execute(
        text("SELECT COUNT(*) FROM card_submissions WHERE submitted_by = :user_id"),
        {"user_id": user_id},
    ).scalar()

    modifications_count = db.session.execute(
        text("SELECT COUNT(*) FROM card_modifications WHERE submitted_by = :user_id"),
        {"user_id": user_id},
    ).scalar()

    if submissions_count > 0 or modifications_count > 0:
        user.is_active = False
        db.session.commit()
        return jsonify(
            {
                "message": f"User deactivated. User has {submissions_count} submissions and {modifications_count} modifications."
            }
        )
    else:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully"})


@bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@jwt_required()
def admin_reset_user_password(user_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if not data or "new_password" not in data:
        return jsonify({"message": "New password required"}), 400

    try:
        # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
        user.set_password(data["new_password"])
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    db.session.commit()

    return jsonify({"message": "Password reset successfully"})


# Tag Management
@bp.route("/tags", methods=["GET"])
@jwt_required()
def admin_get_tags():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    tags_with_counts = (
        db.session.query(Tag.name, func.count(card_tags.c.card_id).label("count"))
        .outerjoin(card_tags)
        .group_by(Tag.name)
        .all()
    )

    tags = [{"name": name, "count": count} for name, count in tags_with_counts]
    return jsonify(tags)


@bp.route("/tags", methods=["POST"])
@jwt_required()
def admin_create_tag():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"message": "Tag name is required"}), 400

    tag_name = data["name"].strip().lower()
    if not tag_name:
        return jsonify({"message": "Tag name cannot be empty"}), 400

    existing_tag = Tag.query.filter_by(name=tag_name).first()
    if existing_tag:
        return jsonify({"message": "Tag already exists"}), 400

    tag = Tag(name=tag_name)
    db.session.add(tag)
    db.session.commit()

    return jsonify({"name": tag.name, "count": 0}), 201


@bp.route("/tags/<string:tag_name>", methods=["PUT"])
@jwt_required()
def admin_update_tag(tag_name):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    tag = Tag.query.filter_by(name=tag_name).first_or_404()
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({"message": "New tag name is required"}), 400

    new_name = data["name"].strip().lower()
    if not new_name:
        return jsonify({"message": "Tag name cannot be empty"}), 400

    if new_name != tag.name:
        existing_tag = Tag.query.filter_by(name=new_name).first()
        if existing_tag:
            return jsonify({"message": "Tag name already exists"}), 400

    tag.name = new_name
    db.session.commit()

    count = (
        db.session.query(func.count(card_tags.c.card_id))
        .filter(card_tags.c.tag_id == tag.id)
        .scalar()
    )

    return jsonify({"name": tag.name, "count": count or 0})


@bp.route("/tags/<string:tag_name>", methods=["DELETE"])
@jwt_required()
def admin_delete_tag(tag_name):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    tag = Tag.query.filter_by(name=tag_name).first_or_404()

    count = (
        db.session.query(func.count(card_tags.c.card_id))
        .filter(card_tags.c.tag_id == tag.id)
        .scalar()
    )

    db.session.delete(tag)
    db.session.commit()

    message = f"Tag '{tag_name}' deleted successfully"
    if count and count > 0:
        message += f" and removed from {count} card{'s' if count != 1 else ''}"

    return jsonify({"message": message})


# Resource Configuration Management
@bp.route("/resources/config", methods=["GET"])
@jwt_required()
def admin_get_resource_configs():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        configs = ResourceConfig.query.all()
        return jsonify([config.to_dict() for config in configs])
    except Exception as e:
        current_app.logger.error(f"Error getting resource configs: {str(e)}")
        return jsonify({"error": "Failed to load resource configurations"}), 500


@bp.route("/resources/config/<int:config_id>", methods=["PUT"])
@jwt_required()
def admin_update_resource_config(config_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        config = ResourceConfig.query.get_or_404(config_id)
        data = request.get_json()

        if "value" in data:
            config.value = data["value"]
        if "description" in data:
            config.description = data["description"]

        config.updated_date = datetime.utcnow()
        db.session.commit()

        return jsonify(
            {"message": "Configuration updated successfully", "config": config.to_dict()}
        )
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating resource config: {str(e)}")
        return jsonify({"error": "Failed to update configuration"}), 500


@bp.route("/resources/config", methods=["POST"])
@jwt_required()
def admin_create_resource_config():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        data = request.get_json()

        existing = ResourceConfig.query.filter_by(key=data["key"]).first()
        if existing:
            return jsonify({"error": "Configuration key already exists"}), 400

        config = ResourceConfig(
            key=data["key"], value=data["value"], description=data.get("description", "")
        )
        db.session.add(config)
        db.session.commit()

        return (
            jsonify({"message": "Configuration created successfully", "config": config.to_dict()}),
            201,
        )
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating resource config: {str(e)}")
        return jsonify({"error": "Failed to create configuration"}), 500


# Quick Access Item Management
@bp.route("/resources/quick-access", methods=["GET"])
@jwt_required()
def admin_get_quick_access_items():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        items = QuickAccessItem.query.order_by(
            QuickAccessItem.display_order, QuickAccessItem.id
        ).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        current_app.logger.error(f"Error getting quick access items: {str(e)}")
        return jsonify({"error": "Failed to load quick access items"}), 500


@bp.route("/resources/quick-access/<int:item_id>", methods=["GET"])
@jwt_required()
def admin_get_quick_access_item(item_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = QuickAccessItem.query.get_or_404(item_id)
        return jsonify(item.to_dict())
    except Exception as e:
        current_app.logger.error(f"Error getting quick access item: {str(e)}")
        return jsonify({"error": "Failed to load quick access item"}), 500


@bp.route("/resources/quick-access", methods=["POST"])
@jwt_required()
def admin_create_quick_access_item():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        data = request.get_json()

        existing = QuickAccessItem.query.filter_by(identifier=data["identifier"]).first()
        if existing:
            return jsonify({"error": "Quick access item with this identifier already exists"}), 400

        item = QuickAccessItem(
            identifier=data["identifier"],
            title=data["title"],
            subtitle=data["subtitle"],
            phone=data["phone"],
            color=data.get("color", "blue"),
            icon=data.get("icon", "building"),
            display_order=data.get("display_order", 0),
            is_active=data.get("is_active", True),
        )
        db.session.add(item)
        db.session.commit()

        return (
            jsonify({"message": "Quick access item created successfully", "item": item.to_dict()}),
            201,
        )
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating quick access item: {str(e)}")
        return jsonify({"error": "Failed to create quick access item"}), 500


@bp.route("/resources/quick-access/<int:item_id>", methods=["PUT"])
@jwt_required()
def admin_update_quick_access_item(item_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = QuickAccessItem.query.get_or_404(item_id)
        data = request.get_json()

        if "identifier" in data and data["identifier"] != item.identifier:
            existing = QuickAccessItem.query.filter_by(identifier=data["identifier"]).first()
            if existing:
                return (
                    jsonify({"error": "Quick access item with this identifier already exists"}),
                    400,
                )

        if "identifier" in data:
            item.identifier = data["identifier"]
        if "title" in data:
            item.title = data["title"]
        if "subtitle" in data:
            item.subtitle = data["subtitle"]
        if "phone" in data:
            item.phone = data["phone"]
        if "color" in data:
            item.color = data["color"]
        if "icon" in data:
            item.icon = data["icon"]
        if "display_order" in data:
            item.display_order = data["display_order"]
        if "is_active" in data:
            item.is_active = data["is_active"]

        db.session.commit()

        return jsonify(
            {"message": "Quick access item updated successfully", "item": item.to_dict()}
        )
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating quick access item: {str(e)}")
        return jsonify({"error": "Failed to update quick access item"}), 500


@bp.route("/resources/quick-access/<int:item_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_quick_access_item(item_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = QuickAccessItem.query.get_or_404(item_id)
        db.session.delete(item)
        db.session.commit()

        return jsonify({"message": "Quick access item deleted successfully"})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting quick access item: {str(e)}")
        return jsonify({"error": "Failed to delete quick access item"}), 500


# Resource Item Management
@bp.route("/resources/items", methods=["GET"])
@jwt_required()
def admin_get_resource_items():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        items = ResourceItem.query.order_by(
            ResourceItem.category, ResourceItem.display_order, ResourceItem.title
        ).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        current_app.logger.error(f"Error getting resource items: {str(e)}")
        return jsonify({"error": "Failed to load resource items"}), 500


@bp.route("/resources/items/<int:item_id>", methods=["GET"])
@jwt_required()
def admin_get_resource_item(item_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = ResourceItem.query.get_or_404(item_id)
        return jsonify(item.to_dict())
    except Exception as e:
        current_app.logger.error(f"Error getting resource item: {str(e)}")
        return jsonify({"error": "Failed to load resource item"}), 500


@bp.route("/resources/items", methods=["POST"])
@jwt_required()
def admin_create_resource_item():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        data = request.get_json()

        item = ResourceItem(
            title=data["title"],
            url=data["url"],
            description=data["description"],
            category=data["category"],
            phone=data.get("phone"),
            address=data.get("address"),
            icon=data.get("icon", "building"),
            display_order=data.get("display_order", 0),
            is_active=data.get("is_active", True),
        )
        db.session.add(item)
        db.session.commit()

        return (
            jsonify({"message": "Resource item created successfully", "item": item.to_dict()}),
            201,
        )
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating resource item: {str(e)}")
        return jsonify({"error": "Failed to create resource item"}), 500


@bp.route("/resources/items/<int:item_id>", methods=["PUT"])
@jwt_required()
def admin_update_resource_item(item_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = ResourceItem.query.get_or_404(item_id)
        data = request.get_json()

        if "title" in data:
            item.title = data["title"]
        if "url" in data:
            item.url = data["url"]
        if "description" in data:
            item.description = data["description"]
        if "category" in data:
            item.category = data["category"]
        if "phone" in data:
            item.phone = data["phone"]
        if "address" in data:
            item.address = data["address"]
        if "icon" in data:
            item.icon = data["icon"]
        if "display_order" in data:
            item.display_order = data["display_order"]
        if "is_active" in data:
            item.is_active = data["is_active"]

        item.updated_date = datetime.utcnow()
        db.session.commit()

        return jsonify({"message": "Resource item updated successfully", "item": item.to_dict()})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating resource item: {str(e)}")
        return jsonify({"error": "Failed to update resource item"}), 500


@bp.route("/resources/items/<int:item_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_resource_item(item_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = ResourceItem.query.get_or_404(item_id)
        db.session.delete(item)
        db.session.commit()

        return jsonify({"message": "Resource item deleted successfully"})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting resource item: {str(e)}")
        return jsonify({"error": "Failed to delete resource item"}), 500


# Help Wanted Report Management
@bp.route("/help-wanted/reports", methods=["GET"])
@jwt_required()
def admin_get_help_wanted_reports():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    status = request.args.get("status", "pending")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = HelpWantedReport.query

    if status != "all":
        query = query.filter_by(status=status)

    total_count = query.count()
    reports = query.order_by(HelpWantedReport.created_date.desc()).offset(offset).limit(limit).all()

    return jsonify(
        {
            "reports": [report.to_dict() for report in reports],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/help-wanted/reports/<int:report_id>/resolve", methods=["POST"])
@jwt_required()
def admin_resolve_help_wanted_report(report_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    report = HelpWantedReport.query.get_or_404(report_id)
    data = request.get_json() or {}

    if report.status != "pending":
        return jsonify({"message": "Report already reviewed"}), 400

    action = data.get("action")  # 'dismiss', 'delete_post'

    report.status = "resolved"
    report.reviewed_by = user_id
    report.reviewed_date = datetime.utcnow()
    report.resolution_notes = data.get("notes", "")

    # Decrement report count on the post
    post = report.post
    if post.report_count > 0:
        post.report_count -= 1

    if action == "delete_post":
        # Delete the reported post
        db.session.delete(post)
        report.resolution_notes = f"Post deleted. {report.resolution_notes}".strip()

    db.session.commit()

    return jsonify({"message": "Report resolved successfully", "report": report.to_dict()})


@bp.route("/help-wanted/posts", methods=["GET"])
@jwt_required()
def admin_get_help_wanted_posts():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    status = request.args.get("status")
    category = request.args.get("category")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = HelpWantedPost.query

    if status:
        query = query.filter_by(status=status)

    if category:
        query = query.filter_by(category=category)

    total_count = query.count()
    posts = query.order_by(HelpWantedPost.created_date.desc()).offset(offset).limit(limit).all()

    return jsonify(
        {
            "posts": [post.to_dict() for post in posts],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/help-wanted/posts/<int:post_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_help_wanted_post(post_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    post = HelpWantedPost.query.get_or_404(post_id)
    db.session.delete(post)
    db.session.commit()

    return jsonify({"message": "Help wanted post deleted successfully"})


# Review Management
@bp.route("/reviews", methods=["GET"])
@jwt_required()
def admin_get_reviews():
    """Get all reviews for admin, optionally filtered by reported status."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    status = request.args.get("status", "all")  # all, reported, hidden
    card_id = request.args.get("card_id", type=int)
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = Review.query

    if status == "reported":
        query = query.filter_by(reported=True)
    elif status == "hidden":
        query = query.filter_by(hidden=True)

    if card_id:
        query = query.filter_by(card_id=card_id)

    total_count = query.count()
    reviews = query.order_by(Review.created_date.desc()).offset(offset).limit(limit).all()

    # Include card information and reported info with each review
    reviews_data = []
    for review in reviews:
        review_dict = review.to_dict(include_reported=True)
        if review.card:
            review_dict["card"] = {
                "id": review.card.id,
                "name": review.card.name,
                "image_url": review.card.image_url,
            }
        reviews_data.append(review_dict)

    return jsonify(
        {
            "reviews": reviews_data,
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/reviews/<int:review_id>/hide", methods=["POST"])
@jwt_required()
def admin_hide_review(review_id):
    """Hide a reported review."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    review = Review.query.get_or_404(review_id)
    data = request.get_json() or {}

    review.hidden = True
    db.session.commit()

    return jsonify(
        {"message": "Review hidden successfully", "review": review.to_dict(include_reported=True)}
    )


@bp.route("/reviews/<int:review_id>/unhide", methods=["POST"])
@jwt_required()
def admin_unhide_review(review_id):
    """Unhide a review and clear its report."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    review = Review.query.get_or_404(review_id)

    review.hidden = False
    review.reported = False
    review.reported_by = None
    review.reported_date = None
    review.reported_reason = None
    db.session.commit()

    return jsonify(
        {"message": "Review unhidden successfully", "review": review.to_dict(include_reported=True)}
    )


@bp.route("/reviews/<int:review_id>/dismiss-report", methods=["POST"])
@jwt_required()
def admin_dismiss_review_report(review_id):
    """Dismiss a report without hiding the review."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    review = Review.query.get_or_404(review_id)

    review.reported = False
    review.reported_by = None
    review.reported_date = None
    review.reported_reason = None
    db.session.commit()

    return jsonify(
        {
            "message": "Report dismissed successfully",
            "review": review.to_dict(include_reported=True),
        }
    )


@bp.route("/reviews/<int:review_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_review(review_id):
    """Permanently delete a review."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    review = Review.query.get_or_404(review_id)
    db.session.delete(review)
    db.session.commit()

    return jsonify({"message": "Review deleted successfully"})


# Forum Category Management
@bp.route("/forums/categories", methods=["GET"])
@jwt_required()
def admin_get_forum_categories():
    """Get all forum categories (including inactive ones)."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    categories = ForumCategory.query.order_by(ForumCategory.display_order, ForumCategory.id).all()
    return jsonify([cat.to_dict(include_stats=True) for cat in categories])


@bp.route("/forums/categories", methods=["POST"])
@jwt_required()
def admin_create_forum_category():
    """Create a new forum category."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not all(k in data for k in ["name", "description"]):
        return jsonify({"message": "Missing required fields: name, description"}), 400

    # Check if category with this name exists
    existing = ForumCategory.query.filter_by(name=data["name"]).first()
    if existing:
        return jsonify({"message": "A category with this name already exists"}), 400

    # Generate unique slug
    base_slug = generate_slug(data["name"])
    slug = base_slug
    counter = 1
    while ForumCategory.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    category = ForumCategory(
        name=data["name"],
        description=data["description"],
        slug=slug,
        display_order=data.get("display_order", 0),
        is_active=data.get("is_active", True),
        created_by=user_id,
    )

    db.session.add(category)
    db.session.commit()

    return jsonify(category.to_dict()), 201


@bp.route("/forums/categories/<int:category_id>", methods=["PUT"])
@jwt_required()
def admin_update_forum_category(category_id):
    """Update a forum category."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    category = ForumCategory.query.get_or_404(category_id)
    data = request.get_json()

    if "name" in data:
        # Check if new name conflicts with existing category
        existing = (
            ForumCategory.query.filter_by(name=data["name"])
            .filter(ForumCategory.id != category_id)
            .first()
        )
        if existing:
            return jsonify({"message": "A category with this name already exists"}), 400

        category.name = data["name"]
        # Regenerate slug
        base_slug = generate_slug(data["name"])
        slug = base_slug
        counter = 1
        while (
            ForumCategory.query.filter_by(slug=slug).filter(ForumCategory.id != category_id).first()
        ):
            slug = f"{base_slug}-{counter}"
            counter += 1
        category.slug = slug

    if "description" in data:
        category.description = data["description"]
    if "display_order" in data:
        category.display_order = data["display_order"]
    if "is_active" in data:
        category.is_active = data["is_active"]

    db.session.commit()

    return jsonify(category.to_dict())


@bp.route("/forums/categories/<int:category_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_forum_category(category_id):
    """Delete a forum category (and all its threads/posts)."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    category = ForumCategory.query.get_or_404(category_id)
    thread_count = category.threads.count()

    db.session.delete(category)
    db.session.commit()

    message = f"Category deleted successfully"
    if thread_count > 0:
        message += f" along with {thread_count} thread{'s' if thread_count != 1 else ''}"

    return jsonify({"message": message})


# Forum Category Request Management
@bp.route("/forums/category-requests", methods=["GET"])
@jwt_required()
def admin_get_forum_category_requests():
    """Get all category requests."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    status = request.args.get("status", "pending")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = ForumCategoryRequest.query

    if status != "all":
        query = query.filter_by(status=status)

    total_count = query.count()
    requests_list = (
        query.order_by(ForumCategoryRequest.created_date.desc()).offset(offset).limit(limit).all()
    )

    return jsonify(
        {
            "requests": [req.to_dict() for req in requests_list],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/forums/category-requests/<int:request_id>/approve", methods=["POST"])
@jwt_required()
def admin_approve_forum_category_request(request_id):
    """Approve a category request and create the category."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    category_request = ForumCategoryRequest.query.get_or_404(request_id)

    if category_request.status != "pending":
        return jsonify({"message": "Request already reviewed"}), 400

    # Check if category with this name exists
    existing = ForumCategory.query.filter_by(name=category_request.name).first()
    if existing:
        return jsonify({"message": "A category with this name already exists"}), 400

    # Generate unique slug
    base_slug = generate_slug(category_request.name)
    slug = base_slug
    counter = 1
    while ForumCategory.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create the category
    category = ForumCategory(
        name=category_request.name,
        description=category_request.description,
        slug=slug,
        display_order=0,
        is_active=True,
        created_by=user_id,
    )

    db.session.add(category)
    db.session.flush()  # Get category ID

    # Update request
    category_request.status = "approved"
    category_request.reviewed_by = user_id
    category_request.reviewed_date = datetime.utcnow()
    category_request.category_id = category.id

    db.session.commit()

    return jsonify(
        {
            "message": "Category request approved and category created",
            "category": category.to_dict(),
            "request": category_request.to_dict(),
        }
    )


@bp.route("/forums/category-requests/<int:request_id>/reject", methods=["POST"])
@jwt_required()
def admin_reject_forum_category_request(request_id):
    """Reject a category request."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    category_request = ForumCategoryRequest.query.get_or_404(request_id)
    data = request.get_json() or {}

    if category_request.status != "pending":
        return jsonify({"message": "Request already reviewed"}), 400

    category_request.status = "rejected"
    category_request.reviewed_by = user_id
    category_request.reviewed_date = datetime.utcnow()
    category_request.review_notes = data.get("notes", "")

    db.session.commit()

    return jsonify({"message": "Category request rejected", "request": category_request.to_dict()})


# Forum Thread Management
@bp.route("/forums/threads", methods=["GET"])
@jwt_required()
def admin_get_forum_threads():
    """Get all forum threads with filtering."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    category_id = request.args.get("category_id", type=int)
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = ForumThread.query

    if category_id:
        query = query.filter_by(category_id=category_id)

    total_count = query.count()
    threads = query.order_by(ForumThread.created_date.desc()).offset(offset).limit(limit).all()

    return jsonify(
        {
            "threads": [thread.to_dict() for thread in threads],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/forums/threads/<int:thread_id>/pin", methods=["POST"])
@jwt_required()
def admin_pin_forum_thread(thread_id):
    """Pin or unpin a thread."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    thread = ForumThread.query.get_or_404(thread_id)
    data = request.get_json() or {}

    thread.is_pinned = data.get("is_pinned", not thread.is_pinned)
    db.session.commit()

    status = "pinned" if thread.is_pinned else "unpinned"
    return jsonify({"message": f"Thread {status} successfully", "thread": thread.to_dict()})


@bp.route("/forums/threads/<int:thread_id>/lock", methods=["POST"])
@jwt_required()
def admin_lock_forum_thread(thread_id):
    """Lock or unlock a thread."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    thread = ForumThread.query.get_or_404(thread_id)
    data = request.get_json() or {}

    thread.is_locked = data.get("is_locked", not thread.is_locked)
    db.session.commit()

    status = "locked" if thread.is_locked else "unlocked"
    return jsonify({"message": f"Thread {status} successfully", "thread": thread.to_dict()})


@bp.route("/forums/threads/<int:thread_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_forum_thread(thread_id):
    """Delete a forum thread (and all its posts)."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    thread = ForumThread.query.get_or_404(thread_id)
    post_count = thread.posts.count()

    db.session.delete(thread)
    db.session.commit()

    message = f"Thread deleted successfully"
    if post_count > 0:
        message += f" along with {post_count} post{'s' if post_count != 1 else ''}"

    return jsonify({"message": message})


# Forum Report Management
@bp.route("/forums/reports", methods=["GET"])
@jwt_required()
def admin_get_forum_reports():
    """Get all forum reports."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    status = request.args.get("status", "pending")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = ForumReport.query

    if status != "all":
        query = query.filter_by(status=status)

    total_count = query.count()
    reports = query.order_by(ForumReport.created_date.desc()).offset(offset).limit(limit).all()

    return jsonify(
        {
            "reports": [report.to_dict() for report in reports],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/forums/reports/<int:report_id>/resolve", methods=["POST"])
@jwt_required()
def admin_resolve_forum_report(report_id):
    """Resolve a forum report."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = int(get_jwt_identity())
    report = ForumReport.query.get_or_404(report_id)
    data = request.get_json() or {}

    if report.status != "pending":
        return jsonify({"message": "Report already reviewed"}), 400

    action = data.get("action")  # 'dismiss', 'delete_post', 'delete_thread'

    report.status = "resolved"
    report.reviewed_by = user_id
    report.reviewed_date = datetime.utcnow()
    report.resolution_notes = data.get("notes", "")

    # Decrement report count
    if report.post_id:
        # Report on a post
        post = report.post
        if post.report_count > 0:
            post.report_count -= 1

        if action == "delete_post":
            db.session.delete(post)
            report.resolution_notes = f"Post deleted. {report.resolution_notes}".strip()
    else:
        # Report on a thread
        thread = report.thread
        if thread.report_count > 0:
            thread.report_count -= 1

        if action == "delete_thread":
            db.session.delete(thread)
            report.resolution_notes = f"Thread deleted. {report.resolution_notes}".strip()

    db.session.commit()

    return jsonify({"message": "Report resolved successfully", "report": report.to_dict()})
