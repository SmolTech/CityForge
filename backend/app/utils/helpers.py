import re

from flask import jsonify
from flask_jwt_extended import get_jwt_identity

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_slug(text):
    """Generate a URL-friendly slug from text."""
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug.strip("-")


def require_admin():
    """Check if current user is admin, return error response if not."""
    from app.models.user import User

    user = User.query.get(get_jwt_identity())
    if not user or user.role != "admin":
        return jsonify({"message": "Admin access required"}), 403
    return None
