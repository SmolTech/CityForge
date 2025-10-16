from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models.help_wanted import HelpWantedComment, HelpWantedPost, HelpWantedReport
from app.models.user import User

bp = Blueprint("help_wanted", __name__)


@bp.route("/api/help-wanted", methods=["GET"])
@jwt_required()
def get_help_wanted_posts():
    """Get all help wanted posts with filtering options."""
    category = request.args.get("category")
    status = request.args.get("status", "open")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = HelpWantedPost.query

    if category and category != "all":
        query = query.filter_by(category=category)

    if status and status != "all":
        query = query.filter_by(status=status)

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


@bp.route("/api/help-wanted/<int:post_id>", methods=["GET"])
@jwt_required()
def get_help_wanted_post(post_id):
    """Get a specific help wanted post with comments."""
    post = HelpWantedPost.query.get_or_404(post_id)
    return jsonify(post.to_dict(include_comments=True))


@bp.route("/api/help-wanted", methods=["POST"])
@jwt_required()
def create_help_wanted_post():
    """Create a new help wanted post."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    data = request.get_json()

    if not data or not all(k in data for k in ["title", "description", "category"]):
        return jsonify({"message": "Missing required fields: title, description, category"}), 400

    valid_categories = ["hiring", "collaboration", "general"]
    if data["category"] not in valid_categories:
        return (
            jsonify(
                {"message": f"Invalid category. Must be one of: {', '.join(valid_categories)}"}
            ),
            400,
        )

    post = HelpWantedPost(
        title=data["title"],
        description=data["description"],
        category=data["category"],
        location=data.get("location"),
        budget=data.get("budget"),
        contact_preference=data.get("contact_preference", "message"),
        created_by=user_id,
    )

    db.session.add(post)
    db.session.commit()

    return jsonify(post.to_dict()), 201


@bp.route("/api/help-wanted/<int:post_id>", methods=["PUT"])
@jwt_required()
def update_help_wanted_post(post_id):
    """Update a help wanted post (only by creator)."""
    user_id = int(get_jwt_identity())
    post = HelpWantedPost.query.get_or_404(post_id)

    if post.created_by != user_id:
        return jsonify({"message": "You can only edit your own posts"}), 403

    data = request.get_json()

    if "title" in data:
        post.title = data["title"]
    if "description" in data:
        post.description = data["description"]
    if "category" in data:
        valid_categories = ["hiring", "collaboration", "general"]
        if data["category"] not in valid_categories:
            return (
                jsonify(
                    {"message": f"Invalid category. Must be one of: {', '.join(valid_categories)}"}
                ),
                400,
            )
        post.category = data["category"]
    if "location" in data:
        post.location = data["location"]
    if "budget" in data:
        post.budget = data["budget"]
    if "contact_preference" in data:
        post.contact_preference = data["contact_preference"]
    if "status" in data:
        if data["status"] not in ["open", "closed"]:
            return jsonify({"message": "Invalid status. Must be 'open' or 'closed'"}), 400
        post.status = data["status"]

    db.session.commit()

    return jsonify(post.to_dict())


@bp.route("/api/help-wanted/<int:post_id>", methods=["DELETE"])
@jwt_required()
def delete_help_wanted_post(post_id):
    """Delete a help wanted post (only by creator)."""
    user_id = int(get_jwt_identity())
    post = HelpWantedPost.query.get_or_404(post_id)

    if post.created_by != user_id:
        return jsonify({"message": "You can only delete your own posts"}), 403

    db.session.delete(post)
    db.session.commit()

    return jsonify({"message": "Post deleted successfully"}), 200


@bp.route("/api/help-wanted/<int:post_id>/comments", methods=["POST"])
@jwt_required()
def create_comment(post_id):
    """Add a comment to a help wanted post."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    HelpWantedPost.query.get_or_404(post_id)  # Verify post exists
    data = request.get_json()

    if not data or "content" not in data:
        return jsonify({"message": "Missing required field: content"}), 400

    parent_id = data.get("parent_id")
    if parent_id:
        parent_comment = HelpWantedComment.query.get(parent_id)
        if not parent_comment or parent_comment.post_id != post_id:
            return jsonify({"message": "Invalid parent comment"}), 400

    comment = HelpWantedComment(
        post_id=post_id,
        content=data["content"],
        parent_id=parent_id,
        created_by=user_id,
    )

    db.session.add(comment)
    db.session.commit()

    return jsonify(comment.to_dict(include_replies=False)), 201


@bp.route("/api/help-wanted/<int:post_id>/comments/<int:comment_id>", methods=["PUT"])
@jwt_required()
def update_comment(post_id, comment_id):
    """Update a comment (only by creator)."""
    user_id = int(get_jwt_identity())
    comment = HelpWantedComment.query.get_or_404(comment_id)

    if comment.post_id != post_id:
        return jsonify({"message": "Comment does not belong to this post"}), 404

    if comment.created_by != user_id:
        return jsonify({"message": "You can only edit your own comments"}), 403

    data = request.get_json()

    if not data or "content" not in data:
        return jsonify({"message": "Missing required field: content"}), 400

    comment.content = data["content"]
    db.session.commit()

    return jsonify(comment.to_dict(include_replies=False))


@bp.route("/api/help-wanted/<int:post_id>/comments/<int:comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(post_id, comment_id):
    """Delete a comment (only by creator)."""
    user_id = int(get_jwt_identity())
    comment = HelpWantedComment.query.get_or_404(comment_id)

    if comment.post_id != post_id:
        return jsonify({"message": "Comment does not belong to this post"}), 404

    if comment.created_by != user_id:
        return jsonify({"message": "You can only delete your own comments"}), 403

    db.session.delete(comment)
    db.session.commit()

    return jsonify({"message": "Comment deleted successfully"}), 200


@bp.route("/api/help-wanted/<int:post_id>/report", methods=["POST"])
@jwt_required()
def report_post(post_id):
    """Report a help wanted post for review."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    post = HelpWantedPost.query.get_or_404(post_id)
    data = request.get_json()

    if not data or "reason" not in data:
        return jsonify({"message": "Missing required field: reason"}), 400

    valid_reasons = ["spam", "inappropriate", "misleading", "other"]
    if data["reason"] not in valid_reasons:
        return (
            jsonify({"message": f"Invalid reason. Must be one of: {', '.join(valid_reasons)}"}),
            400,
        )

    # Check if user already reported this post
    existing_report = HelpWantedReport.query.filter_by(
        post_id=post_id, reported_by=user_id, status="pending"
    ).first()

    if existing_report:
        return jsonify({"message": "You have already reported this post"}), 400

    report = HelpWantedReport(
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


@bp.route("/api/help-wanted/my-posts", methods=["GET"])
@jwt_required()
def get_my_posts():
    """Get the current user's help wanted posts."""
    user_id = int(get_jwt_identity())
    posts = (
        HelpWantedPost.query.filter_by(created_by=user_id)
        .order_by(HelpWantedPost.created_date.desc())
        .all()
    )
    return jsonify([post.to_dict() for post in posts])
