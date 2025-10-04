from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from app import db
from app.models.card import Card, CardModification, CardSubmission, Tag, card_tags
from app.models.user import User

bp = Blueprint("cards", __name__)


@bp.route("/api/cards", methods=["GET"])
def get_cards():
    search = request.args.get("search", "").strip()
    tags = request.args.getlist("tags")
    featured_only = request.args.get("featured", "false").lower() == "true"
    include_share_urls = request.args.get("share_urls", "false").lower() == "true"
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = Card.query.filter_by(approved=True)

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

    if tags:
        for tag in tags:
            query = query.filter(Card.tags.any(Tag.name.ilike(f"%{tag}%")))

    if featured_only:
        query = query.filter_by(featured=True)

    total_count = query.count()
    cards = query.order_by(Card.featured.desc(), Card.name.asc()).offset(offset).limit(limit).all()

    return jsonify(
        {
            "cards": [card.to_dict(include_share_url=include_share_urls) for card in cards],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/api/cards/<int:card_id>", methods=["GET"])
def get_card(card_id):
    card = Card.query.get_or_404(card_id)
    include_share_url = request.args.get("share_url", "false").lower() == "true"
    return jsonify(card.to_dict(include_share_url=include_share_url))


@bp.route("/api/business/<int:business_id>", methods=["GET"])
@bp.route("/api/business/<int:business_id>/<slug>", methods=["GET"])
def get_business(business_id, slug=None):
    """Get business details by ID and optional slug for shareable URLs."""
    card = Card.query.filter_by(id=business_id, approved=True).first_or_404()

    if slug and slug != card.slug:
        return jsonify({"redirect": f"/business/{business_id}/{card.slug}"}), 301

    return jsonify(card.to_dict(include_share_url=True))


@bp.route("/api/tags", methods=["GET"])
def get_tags():
    tags_with_counts = (
        db.session.query(Tag.name, func.count(card_tags.c.card_id).label("count"))
        .join(card_tags, Tag.id == card_tags.c.tag_id, isouter=True)
        .group_by(Tag.id, Tag.name)
        .order_by(Tag.name.asc())
        .all()
    )

    return jsonify([{"name": tag_name, "count": count} for tag_name, count in tags_with_counts])


@bp.route("/api/submissions", methods=["POST"])
@jwt_required()
def submit_card():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not all(k in data for k in ["name"]):
        return jsonify({"message": "Missing required fields"}), 400

    submission = CardSubmission(
        name=data["name"],
        description=data.get("description", ""),
        website_url=data.get("website_url"),
        phone_number=data.get("phone_number"),
        email=data.get("email"),
        address=data.get("address"),
        address_override_url=data.get("address_override_url"),
        contact_name=data.get("contact_name"),
        image_url=data.get("image_url"),
        tags_text=data.get("tags_text", ""),
        submitted_by=user_id,
    )

    db.session.add(submission)
    db.session.commit()

    return jsonify(submission.to_dict()), 201


@bp.route("/api/submissions", methods=["GET"])
@jwt_required()
def get_user_submissions():
    user_id = int(get_jwt_identity())
    submissions = (
        CardSubmission.query.filter_by(submitted_by=user_id)
        .order_by(CardSubmission.created_date.desc())
        .all()
    )
    return jsonify([submission.to_dict() for submission in submissions])


@bp.route("/api/cards/<int:card_id>/suggest-edit", methods=["POST"])
@jwt_required()
def suggest_card_edit(card_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404

    card = Card.query.get_or_404(card_id)
    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    modification = CardModification(
        card_id=card_id,
        name=data.get("name", card.name),
        description=data.get("description", card.description),
        website_url=data.get("website_url", card.website_url),
        phone_number=data.get("phone_number", card.phone_number),
        email=data.get("email", card.email),
        address=data.get("address", card.address),
        address_override_url=data.get("address_override_url", card.address_override_url),
        contact_name=data.get("contact_name", card.contact_name),
        image_url=data.get("image_url", card.image_url),
        tags_text=data.get("tags_text", ",".join([tag.name for tag in card.tags])),
        submitted_by=user_id,
    )

    db.session.add(modification)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Modification suggestion submitted successfully",
                "modification": modification.to_dict(),
            }
        ),
        201,
    )
