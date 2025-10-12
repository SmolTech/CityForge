from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from app import db
from app.models.card import Card
from app.models.review import Review
from app.models.user import User

bp = Blueprint("reviews", __name__)


@bp.route("/api/cards/<int:card_id>/reviews", methods=["GET"])
def get_card_reviews(card_id):
    """Get all non-hidden reviews for a specific card."""
    card = Card.query.get_or_404(card_id)

    # Get pagination parameters
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)

    # Query non-hidden reviews only
    query = Review.query.filter_by(card_id=card_id, hidden=False).order_by(
        Review.created_date.desc()
    )

    total_count = query.count()
    reviews = query.offset(offset).limit(limit).all()

    # Calculate average rating
    avg_rating = (
        db.session.query(func.avg(Review.rating)).filter_by(card_id=card_id, hidden=False).scalar()
    )

    return jsonify(
        {
            "reviews": [review.to_dict() for review in reviews],
            "total": total_count,
            "offset": offset,
            "limit": limit,
            "average_rating": round(float(avg_rating), 1) if avg_rating else None,
        }
    )


@bp.route("/api/cards/<int:card_id>/reviews", methods=["POST"])
@jwt_required()
def create_review(card_id):
    """Create a new review for a card."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    card = Card.query.get_or_404(card_id)
    data = request.get_json()

    # Validate required fields
    if not data or "rating" not in data:
        return jsonify({"message": "Rating is required"}), 400

    rating = data.get("rating")
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        return jsonify({"message": "Rating must be an integer between 1 and 5"}), 400

    # Check if user has already reviewed this card
    existing_review = Review.query.filter_by(card_id=card_id, user_id=user_id).first()
    if existing_review:
        return jsonify({"message": "You have already reviewed this business"}), 400

    # Create new review (auto-approved)
    review = Review(
        card_id=card_id,
        user_id=user_id,
        rating=rating,
        title=data.get("title", "").strip()[:200],  # Limit title length
        comment=data.get("comment", "").strip(),
        hidden=False,  # Reviews are visible by default
    )

    db.session.add(review)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Review submitted successfully",
                "review": review.to_dict(),
            }
        ),
        201,
    )


@bp.route("/api/reviews/my-reviews", methods=["GET"])
@jwt_required()
def get_my_reviews():
    """Get all reviews submitted by the current user."""
    user_id = int(get_jwt_identity())

    reviews = Review.query.filter_by(user_id=user_id).order_by(Review.created_date.desc()).all()

    # Include card information with each review
    reviews_data = []
    for review in reviews:
        review_dict = review.to_dict()
        if review.card:
            review_dict["card"] = {
                "id": review.card.id,
                "name": review.card.name,
                "image_url": review.card.image_url,
            }
        reviews_data.append(review_dict)

    return jsonify({"reviews": reviews_data, "total": len(reviews_data)})


@bp.route("/api/cards/<int:card_id>/reviews/summary", methods=["GET"])
def get_review_summary(card_id):
    """Get review statistics for a card."""
    card = Card.query.get_or_404(card_id)

    # Get rating distribution for non-hidden reviews
    rating_counts = (
        db.session.query(Review.rating, func.count(Review.id))
        .filter_by(card_id=card_id, hidden=False)
        .group_by(Review.rating)
        .all()
    )

    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for rating, count in rating_counts:
        distribution[rating] = count

    total_reviews = sum(distribution.values())
    avg_rating = (
        db.session.query(func.avg(Review.rating)).filter_by(card_id=card_id, hidden=False).scalar()
    )

    return jsonify(
        {
            "card_id": card_id,
            "total_reviews": total_reviews,
            "average_rating": round(float(avg_rating), 1) if avg_rating else None,
            "rating_distribution": distribution,
        }
    )


@bp.route("/api/reviews/<int:review_id>/report", methods=["POST"])
@jwt_required()
def report_review(review_id):
    """Report a review as inappropriate."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    review = Review.query.get_or_404(review_id)
    data = request.get_json()

    # Validate reason
    reason = data.get("reason", "").strip() if data else ""
    if not reason:
        return jsonify({"message": "Report reason is required"}), 400

    # Update review with report
    review.reported = True
    review.reported_by = user_id
    review.reported_date = datetime.utcnow()
    review.reported_reason = reason

    db.session.commit()

    return jsonify({"message": "Review reported successfully"}), 200
