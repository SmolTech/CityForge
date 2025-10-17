from datetime import UTC, datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required

from app import db, limiter
from app.models.token_blacklist import TokenBlacklist
from app.models.user import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.route("/register", methods=["POST"])
@limiter.limit("3 per hour")
def register():
    data = request.get_json()
    if not data or not all(k in data for k in ["email", "password", "first_name", "last_name"]):
        return jsonify({"message": "Missing required fields"}), 400

    if User.query.filter_by(email=data["email"].lower()).first():
        return jsonify({"message": "Email already registered"}), 400

    user = User(
        email=data["email"].lower(), first_name=data["first_name"], last_name=data["last_name"]
    )

    try:
        # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
        user.set_password(data["password"])
    except ValueError as e:
        return jsonify({"message": str(e)}), 400

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=user.id)

    return jsonify({"access_token": access_token, "user": user.to_dict()}), 201


@bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    data = request.get_json()
    if not data or not all(k in data for k in ["email", "password"]):
        return jsonify({"message": "Missing email or password"}), 400

    user = User.query.filter_by(email=data["email"].lower()).first()

    if user and user.check_password(data["password"]) and user.is_active:
        user.last_login = datetime.utcnow()
        db.session.commit()

        access_token = create_access_token(identity=user.id)

        return jsonify({"access_token": access_token, "user": user.to_dict()})

    return jsonify({"message": "Invalid credentials"}), 401


@bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    jwt_data = get_jwt()
    jti = jwt_data["jti"]
    token_type = jwt_data.get("type", "access")
    user_id = get_jwt_identity()

    # Get token expiration from JWT payload
    exp_timestamp = jwt_data.get("exp")
    expires_at = datetime.fromtimestamp(exp_timestamp, tz=UTC)

    # Add token to database blacklist
    TokenBlacklist.add_token_to_blacklist(
        jti=jti, token_type=token_type, user_id=int(user_id), expires_at=expires_at
    )

    return jsonify({"message": "Successfully logged out"})


@bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user = User.query.get(get_jwt_identity())
    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"user": user.to_dict()})


@bp.route("/update-email", methods=["PUT"])
@jwt_required()
@limiter.limit("5 per hour")
def update_email():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json()
    if not data or "email" not in data:
        return jsonify({"message": "Email is required"}), 400

    new_email = data["email"].lower().strip()

    if "@" not in new_email or "." not in new_email:
        return jsonify({"message": "Invalid email format"}), 400

    existing_user = User.query.filter_by(email=new_email).first()
    if existing_user and existing_user.id != user.id:
        return jsonify({"message": "Email already in use"}), 400

    if "current_password" not in data:
        return jsonify({"message": "Current password is required"}), 400

    if not user.check_password(data["current_password"]):
        return jsonify({"message": "Current password is incorrect"}), 401

    user.email = new_email
    db.session.commit()

    return jsonify({"message": "Email updated successfully", "user": user.to_dict()})


@bp.route("/update-password", methods=["PUT"])
@jwt_required()
@limiter.limit("5 per hour")
def update_password():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json()
    if not data or not all(k in data for k in ["current_password", "new_password"]):
        return jsonify({"message": "Current password and new password are required"}), 400

    if not user.check_password(data["current_password"]):
        return jsonify({"message": "Current password is incorrect"}), 401

    try:
        # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
        user.set_password(data["new_password"])
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    db.session.commit()

    return jsonify({"message": "Password updated successfully"})


@bp.route("/update-profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"message": "No data provided"}), 400

    if "first_name" in data and data["first_name"].strip():
        user.first_name = data["first_name"].strip()

    if "last_name" in data and data["last_name"].strip():
        user.last_name = data["last_name"].strip()

    db.session.commit()

    return jsonify({"message": "Profile updated successfully", "user": user.to_dict()})
