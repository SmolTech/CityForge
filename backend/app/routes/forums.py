from datetime import UTC, datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from app import db, limiter
from app.models.forum import (
    ForumCategory,
    ForumCategoryRequest,
    ForumPost,
    ForumReport,
    ForumThread,
)
from app.models.user import User
from app.schemas import (
    ForumCategoryRequestSchema,
    ForumPostSchema,
    ForumThreadSchema,
    ForumThreadUpdateSchema,
)
from app.utils.helpers import generate_slug

bp = Blueprint("forums", __name__)


# ======================
# Category Endpoints
# ======================


@bp.route("/api/forums/categories", methods=["GET"])
@jwt_required()
def get_categories():
    """Get all active forum categories."""
    include_stats = request.args.get("include_stats", "false").lower() == "true"

    categories = (
        ForumCategory.query.filter_by(is_active=True).order_by(ForumCategory.display_order).all()
    )

    return jsonify([category.to_dict(include_stats=include_stats) for category in categories])


@bp.route("/api/forums/categories/<slug>", methods=["GET"])
@jwt_required()
def get_category_by_slug(slug):
    """Get a specific category by slug."""
    category = ForumCategory.query.filter_by(slug=slug, is_active=True).first_or_404()
    return jsonify(category.to_dict(include_stats=True))


# ======================
# Category Request Endpoints
# ======================


@bp.route("/api/forums/category-requests", methods=["POST"])
@jwt_required()
def request_category():
    """Request a new forum category."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = ForumCategoryRequestSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    # Check if a similar category already exists
    existing_category = ForumCategory.query.filter_by(name=validated_data["name"]).first()
    if existing_category:
        return jsonify({"message": "A category with this name already exists"}), 400

    # Check if user already has a pending request for this category
    existing_request = ForumCategoryRequest.query.filter_by(
        name=validated_data["name"], requested_by=user_id, status="pending"
    ).first()
    if existing_request:
        return jsonify({"message": "You already have a pending request for this category"}), 400

    category_request = ForumCategoryRequest(
        name=validated_data["name"],
        description=validated_data["description"],
        justification=validated_data["justification"],
        requested_by=user_id,
    )

    db.session.add(category_request)
    db.session.commit()

    return jsonify(category_request.to_dict()), 201


@bp.route("/api/forums/category-requests/my-requests", methods=["GET"])
@jwt_required()
def get_my_category_requests():
    """Get the current user's category requests."""
    user_id = int(get_jwt_identity())
    requests = (
        ForumCategoryRequest.query.filter_by(requested_by=user_id)
        .order_by(ForumCategoryRequest.created_date.desc())
        .all()
    )
    return jsonify([req.to_dict() for req in requests])


# ======================
# Thread Endpoints
# ======================


@bp.route("/api/forums/categories/<slug>/threads", methods=["GET"])
@jwt_required()
def get_category_threads(slug):
    """Get all threads in a category."""
    category = ForumCategory.query.filter_by(slug=slug, is_active=True).first_or_404()

    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    # Pinned threads first, then by updated date
    threads_query = ForumThread.query.filter_by(category_id=category.id).order_by(
        ForumThread.is_pinned.desc(), ForumThread.updated_date.desc()
    )

    total_count = threads_query.count()
    threads = threads_query.offset(offset).limit(limit).all()

    return jsonify(
        {
            "threads": [thread.to_dict() for thread in threads],
            "total": total_count,
            "offset": offset,
            "limit": limit,
            "category": category.to_dict(),
        }
    )


@bp.route("/api/forums/threads/<int:thread_id>", methods=["GET"])
@jwt_required()
def get_thread(thread_id):
    """Get a specific thread with all posts."""
    thread = ForumThread.query.get_or_404(thread_id)
    return jsonify(thread.to_dict(include_posts=True))


@bp.route("/api/forums/categories/<slug>/threads", methods=["POST"])
@jwt_required()
@limiter.limit("10 per hour")
def create_thread(slug):
    """Create a new thread in a category."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    category = ForumCategory.query.filter_by(slug=slug, is_active=True).first_or_404()

    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = ForumThreadSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    # Generate unique slug for thread
    base_slug = generate_slug(validated_data["title"])
    thread_slug = base_slug
    counter = 1

    # Ensure slug is unique
    while ForumThread.query.filter_by(slug=thread_slug).first():
        thread_slug = f"{base_slug}-{counter}"
        counter += 1

    # Create thread
    thread = ForumThread(
        category_id=category.id,
        title=validated_data["title"],
        slug=thread_slug,
        created_by=user_id,
    )

    db.session.add(thread)
    db.session.flush()  # Get thread ID

    # Create the first post
    first_post = ForumPost(
        thread_id=thread.id,
        content=validated_data["content"],
        is_first_post=True,
        created_by=user_id,
    )

    db.session.add(first_post)
    db.session.commit()

    return jsonify(thread.to_dict(include_posts=True)), 201


@bp.route("/api/forums/threads/<int:thread_id>", methods=["PUT"])
@jwt_required()
@limiter.limit("20 per hour")
def update_thread(thread_id):
    """Update a thread (only by creator)."""
    user_id = int(get_jwt_identity())
    thread = ForumThread.query.get_or_404(thread_id)

    if thread.created_by != user_id:
        return jsonify({"message": "You can only edit your own threads"}), 403

    if thread.is_locked:
        return jsonify({"message": "Cannot edit a locked thread"}), 403

    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = ForumThreadUpdateSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    # Update title and regenerate slug
    thread.title = validated_data["title"]
    base_slug = generate_slug(validated_data["title"])
    thread_slug = base_slug
    counter = 1
    # Ensure slug is unique (excluding current thread)
    while ForumThread.query.filter_by(slug=thread_slug).filter(ForumThread.id != thread_id).first():
        thread_slug = f"{base_slug}-{counter}"
        counter += 1
    thread.slug = thread_slug

    db.session.commit()

    return jsonify(thread.to_dict())


@bp.route("/api/forums/threads/<int:thread_id>", methods=["DELETE"])
@jwt_required()
def delete_thread(thread_id):
    """Delete a thread (only by creator)."""
    user_id = int(get_jwt_identity())
    thread = ForumThread.query.get_or_404(thread_id)

    if thread.created_by != user_id:
        return jsonify({"message": "You can only delete your own threads"}), 403

    db.session.delete(thread)
    db.session.commit()

    return jsonify({"message": "Thread deleted successfully"}), 200


# ======================
# Post Endpoints
# ======================


@bp.route("/api/forums/threads/<int:thread_id>/posts", methods=["POST"])
@jwt_required()
@limiter.limit("30 per hour")
def create_post(thread_id):
    """Create a new post in a thread."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    thread = ForumThread.query.get_or_404(thread_id)

    if thread.is_locked:
        return jsonify({"message": "Cannot post in a locked thread"}), 403

    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = ForumPostSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    post = ForumPost(thread_id=thread_id, content=validated_data["content"], created_by=user_id)

    db.session.add(post)

    # Update thread's updated_date
    thread.updated_date = datetime.now(UTC)

    db.session.commit()

    return jsonify(post.to_dict()), 201


@bp.route("/api/forums/posts/<int:post_id>", methods=["PUT"])
@jwt_required()
@limiter.limit("20 per hour")
def update_post(post_id):
    """Update a post (only by creator)."""
    user_id = int(get_jwt_identity())
    post = ForumPost.query.get_or_404(post_id)

    if post.created_by != user_id:
        return jsonify({"message": "You can only edit your own posts"}), 403

    if post.thread.is_locked:
        return jsonify({"message": "Cannot edit posts in a locked thread"}), 403

    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = ForumPostSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    post.content = validated_data["content"]
    post.edited_by = user_id
    post.edited_date = datetime.now(UTC)

    db.session.commit()

    return jsonify(post.to_dict())


@bp.route("/api/forums/posts/<int:post_id>", methods=["DELETE"])
@jwt_required()
def delete_post(post_id):
    """Delete a post (only by creator, cannot delete first post)."""
    user_id = int(get_jwt_identity())
    post = ForumPost.query.get_or_404(post_id)

    if post.created_by != user_id:
        return jsonify({"message": "You can only delete your own posts"}), 403

    if post.is_first_post:
        return jsonify({"message": "Cannot delete the first post. Delete the thread instead."}), 403

    db.session.delete(post)
    db.session.commit()

    return jsonify({"message": "Post deleted successfully"}), 200


# ======================
# Reporting Endpoints
# ======================


@bp.route("/api/forums/threads/<int:thread_id>/report", methods=["POST"])
@jwt_required()
def report_thread(thread_id):
    """Report a thread for review."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    thread = ForumThread.query.get_or_404(thread_id)
    data = request.get_json()

    if not data or "reason" not in data:
        return jsonify({"message": "Missing required field: reason"}), 400

    valid_reasons = ["spam", "inappropriate", "harassment", "off_topic", "other"]
    if data["reason"] not in valid_reasons:
        return (
            jsonify({"message": f"Invalid reason. Must be one of: {', '.join(valid_reasons)}"}),
            400,
        )

    # Check if user already reported this thread
    existing_report = ForumReport.query.filter_by(
        thread_id=thread_id, post_id=None, reported_by=user_id, status="pending"
    ).first()

    if existing_report:
        return jsonify({"message": "You have already reported this thread"}), 400

    report = ForumReport(
        thread_id=thread_id,
        post_id=None,
        reason=data["reason"],
        details=data.get("details"),
        reported_by=user_id,
    )

    db.session.add(report)

    # Increment report count on the thread
    thread.report_count += 1

    db.session.commit()

    return jsonify(report.to_dict()), 201


@bp.route("/api/forums/posts/<int:post_id>/report", methods=["POST"])
@jwt_required()
def report_post(post_id):
    """Report a post for review."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    post = ForumPost.query.get_or_404(post_id)
    data = request.get_json()

    if not data or "reason" not in data:
        return jsonify({"message": "Missing required field: reason"}), 400

    valid_reasons = ["spam", "inappropriate", "harassment", "off_topic", "other"]
    if data["reason"] not in valid_reasons:
        return (
            jsonify({"message": f"Invalid reason. Must be one of: {', '.join(valid_reasons)}"}),
            400,
        )

    # Check if user already reported this post
    existing_report = ForumReport.query.filter_by(
        post_id=post_id, reported_by=user_id, status="pending"
    ).first()

    if existing_report:
        return jsonify({"message": "You have already reported this post"}), 400

    report = ForumReport(
        thread_id=post.thread_id,
        post_id=post_id,
        reason=data["reason"],
        details=data.get("details"),
        reported_by=user_id,
    )

    db.session.add(report)

    # Increment report count on the post
    post.report_count += 1

    db.session.commit()

    return jsonify(report.to_dict()), 201


# ======================
# User's Own Content
# ======================


@bp.route("/api/forums/my-threads", methods=["GET"])
@jwt_required()
def get_my_threads():
    """Get the current user's threads."""
    user_id = int(get_jwt_identity())
    threads = (
        ForumThread.query.filter_by(created_by=user_id)
        .order_by(ForumThread.created_date.desc())
        .all()
    )
    return jsonify([thread.to_dict() for thread in threads])


@bp.route("/api/forums/my-posts", methods=["GET"])
@jwt_required()
def get_my_posts():
    """Get the current user's posts."""
    user_id = int(get_jwt_identity())
    posts = (
        ForumPost.query.filter_by(created_by=user_id).order_by(ForumPost.created_date.desc()).all()
    )
    return jsonify([post.to_dict() for post in posts])
