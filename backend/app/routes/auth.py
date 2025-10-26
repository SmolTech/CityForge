from datetime import UTC, datetime

from flask import Blueprint, jsonify, make_response, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)
from marshmallow import ValidationError

from app import db, limiter
from app.models.token_blacklist import TokenBlacklist
from app.models.user import User
from app.schemas import (
    UserLoginSchema,
    UserRegistrationSchema,
    UserUpdateEmailSchema,
    UserUpdatePasswordSchema,
    UserUpdateProfileSchema,
)

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.route("/register", methods=["POST"])
@limiter.limit("3 per hour")
def register():
    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = UserRegistrationSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    # Normalize email to lowercase
    email = validated_data["email"].lower()

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 400

    user = User(
        email=email,
        first_name=validated_data["first_name"],
        last_name=validated_data["last_name"],
    )

    try:
        # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
        user.set_password(validated_data["password"])
    except ValueError as e:
        return jsonify({"message": str(e)}), 400

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=user.id)

    # Return token in response body for mobile apps, and set cookie for web
    response = make_response(jsonify({"user": user.to_dict(), "access_token": access_token}), 201)
    set_access_cookies(response, access_token)

    return response


@bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = UserLoginSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    user = User.query.filter_by(email=validated_data["email"].lower()).first()

    if user and user.check_password(validated_data["password"]) and user.is_active:
        user.last_login = datetime.now(UTC)
        db.session.commit()

        access_token = create_access_token(identity=user.id)

        # Return token in response body for mobile apps, and set cookie for web
        response = make_response(jsonify({"user": user.to_dict(), "access_token": access_token}))
        set_access_cookies(response, access_token)

        return response

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

    response = make_response(jsonify({"message": "Successfully logged out"}))
    unset_jwt_cookies(response)

    return response


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
    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = UserUpdateEmailSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    new_email = validated_data["new_email"].lower()

    existing_user = User.query.filter_by(email=new_email).first()
    if existing_user and existing_user.id != user.id:
        return jsonify({"message": "Email already in use"}), 400

    # Require current password for email changes
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
    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate input data
    schema = UserUpdatePasswordSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    if not user.check_password(validated_data["current_password"]):
        return jsonify({"message": "Current password is incorrect"}), 401

    try:
        # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
        user.set_password(validated_data["new_password"])
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

    # Validate input data
    schema = UserUpdateProfileSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"message": "Validation failed", "errors": err.messages}), 400

    if "first_name" in validated_data and validated_data["first_name"]:
        user.first_name = validated_data["first_name"]

    if "last_name" in validated_data and validated_data["last_name"]:
        user.last_name = validated_data["last_name"]

    db.session.commit()

    return jsonify({"message": "Profile updated successfully", "user": user.to_dict()})
