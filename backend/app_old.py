import os
import re
import uuid
from datetime import datetime, timedelta

from flask import Flask, jsonify, request, send_from_directory
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from flask_sqlalchemy import SQLAlchemy
from opensearchpy import OpenSearch
from sqlalchemy import func
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Configuration
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "uploads")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max file size

database_url = os.getenv("DATABASE_URL")
if not database_url:
    db_user = os.getenv("POSTGRES_USER", "postgres")
    db_password = os.getenv("POSTGRES_PASSWORD", "postgres")
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "community_db")
    database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# OpenSearch configuration
opensearch_host = os.getenv("OPENSEARCH_HOST", "opensearch-service")
opensearch_port = int(os.getenv("OPENSEARCH_PORT", "9200"))
namespace = os.getenv("NAMESPACE", "community")

opensearch_client = OpenSearch(
    hosts=[{"host": opensearch_host, "port": opensearch_port}],
    http_auth=None,
    use_ssl=False,
    verify_certs=False,
    connection_class=None,
)

# Ensure upload directory exists
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_slug(text):
    """Generate a URL-friendly slug from text."""
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug.strip("-")


card_tags = db.Table(
    "card_tags",
    db.Column("card_id", db.Integer, db.ForeignKey("cards.id"), primary_key=True),
    db.Column("tag_id", db.Integer, db.ForeignKey("tags.id"), primary_key=True),
)


class Tag(db.Model):
    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(500), nullable=False, unique=True, index=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "created_date": self.created_date.isoformat()}


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")  # 'admin' or 'user'
    is_active = db.Column(db.Boolean, default=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    def validate_password(self, password):
        """Validate password strength."""
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
        if not any(c.islower() for c in password):
            return False, "Password must contain at least one lowercase letter"
        if not any(c.isupper() for c in password):
            return False, "Password must contain at least one uppercase letter"
        if not any(c.isdigit() for c in password):
            return False, "Password must contain at least one number"
        return True, "Password is valid"

    def set_password(self, password):
        is_valid, message = self.validate_password(password)
        if not is_valid:
            raise ValueError(message)
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "role": self.role,
            "is_active": self.is_active,
            "created_date": self.created_date.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }


class Card(db.Model):
    __tablename__ = "cards"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    description = db.Column(db.Text)
    website_url = db.Column(db.String(255))
    phone_number = db.Column(db.String(20))
    email = db.Column(db.String(100))
    address = db.Column(db.String(255))
    address_override_url = db.Column(db.String(500))  # URL to override Google Maps link
    contact_name = db.Column(db.String(100))
    featured = db.Column(db.Boolean, default=False)
    image_url = db.Column(db.String(255))
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    approved = db.Column(db.Boolean, default=True)
    approved_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    approved_date = db.Column(db.DateTime)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    updated_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tags = db.relationship(
        "Tag", secondary=card_tags, lazy="subquery", backref=db.backref("cards", lazy=True)
    )
    creator = db.relationship("User", foreign_keys=[created_by], backref="created_cards")
    approver = db.relationship("User", foreign_keys=[approved_by], backref="approved_cards")

    @property
    def slug(self):
        """Generate URL-friendly slug from business name."""
        return generate_slug(self.name)

    @property
    def share_url(self):
        """Generate shareable URL for this business."""
        return f"/business/{self.id}/{self.slug}"

    def to_dict(self, include_share_url=False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "website_url": self.website_url,
            "phone_number": self.phone_number,
            "email": self.email,
            "address": self.address,
            "address_override_url": self.address_override_url,
            "contact_name": self.contact_name,
            "featured": self.featured,
            "image_url": self.image_url,
            "approved": self.approved,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "tags": [tag.name for tag in self.tags],
            "creator": self.creator.to_dict() if self.creator else None,
            "approver": self.approver.to_dict() if self.approver else None,
            "approved_date": self.approved_date.isoformat() if self.approved_date else None,
        }

        if include_share_url:
            data["slug"] = self.slug
            data["share_url"] = self.share_url

        return data


class CardSubmission(db.Model):
    __tablename__ = "card_submissions"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    website_url = db.Column(db.String(255))
    phone_number = db.Column(db.String(20))
    email = db.Column(db.String(100))
    address = db.Column(db.String(255))
    address_override_url = db.Column(db.String(500))  # URL to override Google Maps link
    contact_name = db.Column(db.String(100))
    image_url = db.Column(db.String(255))
    tags_text = db.Column(db.Text)  # Comma-separated tag names
    status = db.Column(db.String(20), default="pending")  # 'pending', 'approved', 'rejected'
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    review_notes = db.Column(db.Text)
    card_id = db.Column(
        db.Integer, db.ForeignKey("cards.id"), nullable=True
    )  # If approved and converted
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_date = db.Column(db.DateTime)

    submitter = db.relationship("User", foreign_keys=[submitted_by], backref="submissions")
    reviewer = db.relationship("User", foreign_keys=[reviewed_by], backref="reviewed_submissions")
    card = db.relationship("Card", backref="submission_source")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "website_url": self.website_url,
            "phone_number": self.phone_number,
            "email": self.email,
            "address": self.address,
            "address_override_url": self.address_override_url,
            "contact_name": self.contact_name,
            "image_url": self.image_url,
            "tags_text": self.tags_text,
            "status": self.status,
            "review_notes": self.review_notes,
            "created_date": self.created_date.isoformat(),
            "reviewed_date": self.reviewed_date.isoformat() if self.reviewed_date else None,
            "submitter": self.submitter.to_dict() if self.submitter else None,
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "card_id": self.card_id,
        }


class CardModification(db.Model):
    __tablename__ = "card_modifications"

    id = db.Column(db.Integer, primary_key=True)
    card_id = db.Column(db.Integer, db.ForeignKey("cards.id"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    website_url = db.Column(db.String(255))
    phone_number = db.Column(db.String(20))
    email = db.Column(db.String(100))
    address = db.Column(db.String(255))
    address_override_url = db.Column(db.String(500))  # URL to override Google Maps link
    contact_name = db.Column(db.String(100))
    image_url = db.Column(db.String(255))
    tags_text = db.Column(db.Text)  # Comma-separated tag names
    status = db.Column(db.String(20), default="pending")  # 'pending', 'approved', 'rejected'
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    review_notes = db.Column(db.Text)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_date = db.Column(db.DateTime)

    card = db.relationship("Card", backref="modifications")
    submitter = db.relationship("User", foreign_keys=[submitted_by], backref="card_modifications")
    reviewer = db.relationship("User", foreign_keys=[reviewed_by], backref="reviewed_modifications")

    def to_dict(self):
        return {
            "id": self.id,
            "card_id": self.card_id,
            "name": self.name,
            "description": self.description,
            "website_url": self.website_url,
            "phone_number": self.phone_number,
            "email": self.email,
            "address": self.address,
            "address_override_url": self.address_override_url,
            "contact_name": self.contact_name,
            "image_url": self.image_url,
            "tags_text": self.tags_text,
            "status": self.status,
            "review_notes": self.review_notes,
            "created_date": self.created_date.isoformat(),
            "reviewed_date": self.reviewed_date.isoformat() if self.reviewed_date else None,
            "submitter": self.submitter.to_dict() if self.submitter else None,
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "card": self.card.to_dict() if self.card else None,
        }


class ResourceCategory(db.Model):
    __tablename__ = "resource_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True, index=True)
    display_order = db.Column(db.Integer, default=0)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to resource items
    resource_items = db.relationship("ResourceItem", backref="category_obj", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "display_order": self.display_order,
            "created_date": self.created_date.isoformat(),
        }


class QuickAccessItem(db.Model):
    __tablename__ = "quick_access_items"

    id = db.Column(db.Integer, primary_key=True)
    identifier = db.Column(
        db.String(50), nullable=False, unique=True, index=True
    )  # e.g. 'emergency', 'city-hall'
    title = db.Column(db.String(100), nullable=False)
    subtitle = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    color = db.Column(
        db.String(20), nullable=False, default="blue"
    )  # blue, green, purple, red, etc.
    icon = db.Column(db.String(50), nullable=False, default="building")  # icon name
    display_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.identifier,  # Use identifier as the id for frontend compatibility
            "title": self.title,
            "subtitle": self.subtitle,
            "phone": self.phone,
            "color": self.color,
            "icon": self.icon,
        }


class ResourceItem(db.Model):
    __tablename__ = "resource_items"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    url = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(
        db.String(100), nullable=False, index=True
    )  # Keep string for backward compatibility
    category_id = db.Column(
        db.Integer, db.ForeignKey("resource_categories.id"), nullable=True
    )  # Future use
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    icon = db.Column(db.String(50), nullable=False, default="building")
    display_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    updated_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "description": self.description,
            "category": self.category,
            "phone": self.phone,
            "address": self.address,
            "icon": self.icon,
        }


class ResourceConfig(db.Model):
    __tablename__ = "resource_config"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), nullable=False, unique=True, index=True)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.String(500), nullable=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    updated_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "description": self.description,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
        }


# JWT token blacklist (in production, use Redis or database)
blacklisted_tokens = set()


@jwt.token_in_blocklist_loader
def check_if_token_revoked(_jwt_header, jwt_payload):
    return jwt_payload["jti"] in blacklisted_tokens


@jwt.user_identity_loader
def user_identity_lookup(user):
    return str(user)


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return User.query.filter_by(id=identity).one_or_none()


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "service": "community-backend"})


# Authentication endpoints
@app.route("/api/auth/register", methods=["POST"])
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
        user.set_password(data["password"])  # Uses custom Flask validation, not Django
    except ValueError as e:
        return jsonify({"message": str(e)}), 400

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=user.id)

    return jsonify({"access_token": access_token, "user": user.to_dict()}), 201


@app.route("/api/auth/login", methods=["POST"])
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


@app.route("/api/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    blacklisted_tokens.add(jti)
    return jsonify({"message": "Successfully logged out"})


@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user = User.query.get(get_jwt_identity())
    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"user": user.to_dict()})


@app.route("/api/auth/update-email", methods=["PUT"])
@jwt_required()
def update_email():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json()
    if not data or "email" not in data:
        return jsonify({"message": "Email is required"}), 400

    new_email = data["email"].lower().strip()

    # Basic email validation
    if "@" not in new_email or "." not in new_email:
        return jsonify({"message": "Invalid email format"}), 400

    # Check if email is already taken by another user
    existing_user = User.query.filter_by(email=new_email).first()
    if existing_user and existing_user.id != user.id:
        return jsonify({"message": "Email already in use"}), 400

    # Require current password for verification
    if "current_password" not in data:
        return jsonify({"message": "Current password is required"}), 400

    if not user.check_password(data["current_password"]):
        return jsonify({"message": "Current password is incorrect"}), 401

    # Update email
    user.email = new_email
    db.session.commit()

    return jsonify({"message": "Email updated successfully", "user": user.to_dict()})


@app.route("/api/auth/update-password", methods=["PUT"])
@jwt_required()
def update_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json()
    if not data or not all(k in data for k in ["current_password", "new_password"]):
        return jsonify({"message": "Current password and new password are required"}), 400

    # Verify current password
    if not user.check_password(data["current_password"]):
        return jsonify({"message": "Current password is incorrect"}), 401

    # Update password with validation
    new_password = data["new_password"]
    try:
        # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
        user.set_password(new_password)  # Uses custom Flask validation, not Django
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    db.session.commit()

    return jsonify({"message": "Password updated successfully"})


@app.route("/api/auth/update-profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Update first name and last name if provided
    if "first_name" in data and data["first_name"].strip():
        user.first_name = data["first_name"].strip()

    if "last_name" in data and data["last_name"].strip():
        user.last_name = data["last_name"].strip()

    db.session.commit()

    return jsonify({"message": "Profile updated successfully", "user": user.to_dict()})


# File upload endpoint
@app.route("/api/upload", methods=["POST"])
@jwt_required()
def upload_file():
    if "file" not in request.files:
        return jsonify({"message": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"message": "No file selected"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file.save(os.path.join(app.config["UPLOAD_FOLDER"], unique_filename))

        return jsonify({"filename": unique_filename, "url": f"/api/uploads/{unique_filename}"})

    return jsonify({"message": "Invalid file type"}), 400


@app.route("/api/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/api/cards", methods=["GET"])
def get_cards():
    search = request.args.get("search", "").strip()
    tags = request.args.getlist("tags")
    featured_only = request.args.get("featured", "false").lower() == "true"
    include_share_urls = request.args.get("share_urls", "false").lower() == "true"
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)

    # Only show approved cards for public access
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


@app.route("/api/cards/<int:card_id>", methods=["GET"])
def get_card(card_id):
    card = Card.query.get_or_404(card_id)
    include_share_url = request.args.get("share_url", "false").lower() == "true"
    return jsonify(card.to_dict(include_share_url=include_share_url))


@app.route("/api/business/<int:business_id>", methods=["GET"])
@app.route("/api/business/<int:business_id>/<slug>", methods=["GET"])
def get_business(business_id, slug=None):
    """Get business details by ID and optional slug for shareable URLs."""
    card = Card.query.filter_by(id=business_id, approved=True).first_or_404()

    # Redirect to canonical URL if slug doesn't match
    if slug and slug != card.slug:
        return jsonify({"redirect": f"/business/{business_id}/{card.slug}"}), 301

    return jsonify(card.to_dict(include_share_url=True))


@app.route("/api/tags", methods=["GET"])
def get_tags():
    tags_with_counts = (
        db.session.query(Tag.name, func.count(card_tags.c.card_id).label("count"))
        .join(card_tags, Tag.id == card_tags.c.tag_id, isouter=True)
        .group_by(Tag.id, Tag.name)
        .order_by(Tag.name.asc())
        .all()
    )

    return jsonify([{"name": tag_name, "count": count} for tag_name, count in tags_with_counts])


# Card submission endpoints (for users)
@app.route("/api/submissions", methods=["POST"])
@jwt_required()
def submit_card():
    user_id = get_jwt_identity()
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


@app.route("/api/submissions", methods=["GET"])
@jwt_required()
def get_user_submissions():
    user_id = get_jwt_identity()
    submissions = (
        CardSubmission.query.filter_by(submitted_by=user_id)
        .order_by(CardSubmission.created_date.desc())
        .all()
    )
    return jsonify([submission.to_dict() for submission in submissions])


# Admin endpoints
def require_admin():
    user = User.query.get(get_jwt_identity())
    if not user or user.role != "admin":
        return jsonify({"message": "Admin access required"}), 403
    return None


@app.route("/api/admin/cards", methods=["GET"])
@jwt_required()
def admin_get_cards():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    search = request.args.get("search", "").strip()
    status = request.args.get("status")  # 'approved', 'pending', 'all'
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


@app.route("/api/admin/cards", methods=["POST"])
@jwt_required()
def admin_create_card():
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = get_jwt_identity()
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


@app.route("/api/admin/cards/<int:card_id>", methods=["PUT"])
@jwt_required()
def admin_update_card(card_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    card = Card.query.get_or_404(card_id)
    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Update card fields
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

    # Update tags
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


@app.route("/api/admin/cards/<int:card_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_card(card_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    card = Card.query.get_or_404(card_id)

    # First delete all related card modifications to avoid foreign key constraint violations
    CardModification.query.filter_by(card_id=card_id).delete()

    # Then delete the card itself
    db.session.delete(card)
    db.session.commit()

    return jsonify({"message": "Card deleted successfully"})


@app.route("/api/admin/submissions", methods=["GET"])
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


@app.route("/api/admin/submissions/<int:submission_id>/approve", methods=["POST"])
@jwt_required()
def admin_approve_submission(submission_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = get_jwt_identity()
    submission = CardSubmission.query.get_or_404(submission_id)
    data = request.get_json() or {}

    if submission.status != "pending":
        return jsonify({"message": "Submission already reviewed"}), 400

    # Create card from submission
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

    # Add tags
    if submission.tags_text:
        tag_names = [tag.strip().lower() for tag in submission.tags_text.split(",") if tag.strip()]
        for tag_name in tag_names:
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.session.add(tag)
            card.tags.append(tag)

    db.session.add(card)

    # Update submission
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


@app.route("/api/admin/submissions/<int:submission_id>/reject", methods=["POST"])
@jwt_required()
def admin_reject_submission(submission_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = get_jwt_identity()
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


# Card modification endpoints
@app.route("/api/cards/<int:card_id>/suggest-edit", methods=["POST"])
@jwt_required()
def suggest_card_edit(card_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found"}), 404

    card = Card.query.get_or_404(card_id)
    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Create modification suggestion
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


@app.route("/api/admin/modifications", methods=["GET"])
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


@app.route("/api/admin/modifications/<int:modification_id>/approve", methods=["POST"])
@jwt_required()
def admin_approve_modification(modification_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = get_jwt_identity()
    modification = CardModification.query.get_or_404(modification_id)

    if modification.status != "pending":
        return jsonify({"message": "Modification already reviewed"}), 400

    # Apply modification to the card
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

    # Update tags
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

    # Mark modification as approved
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


@app.route("/api/admin/modifications/<int:modification_id>/reject", methods=["POST"])
@jwt_required()
def admin_reject_modification(modification_id):
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user_id = get_jwt_identity()
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
@app.route("/api/admin/users", methods=["GET"])
@jwt_required()
def admin_get_users():
    """Get all users for admin management"""
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


@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
@jwt_required()
def admin_update_user(user_id):
    """Update user details and permissions"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Prevent users from demoting themselves
    if user_id == current_user_id and "role" in data and data["role"] != "admin":
        return jsonify({"message": "Cannot demote yourself from admin"}), 400

    # Update user fields
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


@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_user(user_id):
    """Delete or deactivate a user"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)

    # Prevent users from deleting themselves
    if user_id == current_user_id:
        return jsonify({"message": "Cannot delete yourself"}), 400

    # Check if user has submitted content
    from sqlalchemy import text

    submissions_count = db.session.execute(
        text("SELECT COUNT(*) FROM card_submissions WHERE submitted_by = :user_id"),
        {"user_id": user_id},
    ).scalar()

    modifications_count = db.session.execute(
        text("SELECT COUNT(*) FROM card_modifications WHERE submitted_by = :user_id"),
        {"user_id": user_id},
    ).scalar()

    if submissions_count > 0 or modifications_count > 0:
        # Soft delete - just deactivate
        user.is_active = False
        db.session.commit()
        return jsonify(
            {
                "message": f"User deactivated. User has {submissions_count} submissions and {modifications_count} modifications."
            }
        )
    else:
        # Hard delete if no content
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully"})


@app.route("/api/admin/users/<int:user_id>/reset-password", methods=["POST"])
@jwt_required()
def admin_reset_user_password(user_id):
    """Reset user password (admin only)"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if not data or "new_password" not in data:
        return jsonify({"message": "New password required"}), 400

    new_password = data["new_password"]
    try:
        # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
        user.set_password(new_password)  # Uses custom Flask validation, not Django
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    db.session.commit()

    return jsonify({"message": "Password reset successfully"})


# Admin tag management endpoints
@app.route("/api/admin/tags", methods=["GET"])
@jwt_required()
def admin_get_tags():
    """Get all tags with usage counts (admin only)"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    # Get all tags with their usage counts
    tags_with_counts = (
        db.session.query(Tag.name, func.count(card_tags.c.card_id).label("count"))
        .outerjoin(card_tags)
        .group_by(Tag.name)
        .all()
    )

    tags = [{"name": name, "count": count} for name, count in tags_with_counts]
    return jsonify(tags)


@app.route("/api/admin/tags", methods=["POST"])
@jwt_required()
def admin_create_tag():
    """Create a new tag (admin only)"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"message": "Tag name is required"}), 400

    tag_name = data["name"].strip().lower()
    if not tag_name:
        return jsonify({"message": "Tag name cannot be empty"}), 400

    # Check if tag already exists
    existing_tag = Tag.query.filter_by(name=tag_name).first()
    if existing_tag:
        return jsonify({"message": "Tag already exists"}), 400

    # Create new tag
    tag = Tag(name=tag_name)
    db.session.add(tag)
    db.session.commit()

    return jsonify({"name": tag.name, "count": 0}), 201


@app.route("/api/admin/tags/<string:tag_name>", methods=["PUT"])
@jwt_required()
def admin_update_tag(tag_name):
    """Update a tag name (admin only)"""
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

    # Check if new name conflicts with another tag
    if new_name != tag.name:
        existing_tag = Tag.query.filter_by(name=new_name).first()
        if existing_tag:
            return jsonify({"message": "Tag name already exists"}), 400

    # Update tag name
    tag.name = new_name
    db.session.commit()

    # Get usage count
    count = (
        db.session.query(func.count(card_tags.c.card_id))
        .filter(card_tags.c.tag_id == tag.id)
        .scalar()
    )

    return jsonify({"name": tag.name, "count": count or 0})


@app.route("/api/admin/tags/<string:tag_name>", methods=["DELETE"])
@jwt_required()
def admin_delete_tag(tag_name):
    """Delete a tag (admin only)"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    tag = Tag.query.filter_by(name=tag_name).first_or_404()

    # Get usage count before deletion
    count = (
        db.session.query(func.count(card_tags.c.card_id))
        .filter(card_tags.c.tag_id == tag.id)
        .scalar()
    )

    # Delete the tag (this will automatically remove it from cards due to the relationship)
    db.session.delete(tag)
    db.session.commit()

    message = f"Tag '{tag_name}' deleted successfully"
    if count and count > 0:
        message += f" and removed from {count} card{'s' if count != 1 else ''}"

    return jsonify({"message": message})


# Resources API endpoints
@app.route("/api/resources/config", methods=["GET"])
def get_resources_config():
    """Get the resources page configuration including title, description, footer, and site info from database"""
    try:
        import json

        # Build config from database values
        config = {}

        # Get all config values at once
        config_items = ResourceConfig.query.all()
        config_dict = {item.key: item.value for item in config_items}

        # Site configuration
        config["site"] = {
            "title": config_dict.get("site_title", "Community Website"),
            "description": config_dict.get(
                "site_description", "Helping connect people to the resources available to them."
            ),
            "domain": config_dict.get("site_domain", "community.local"),
        }

        # Resources configuration
        config["title"] = config_dict.get("resources_title", "Local Resources")
        config["description"] = config_dict.get(
            "resources_description", "Essential links to local services and information"
        )

        # Footer configuration
        footer_json = config_dict.get("resources_footer")
        if footer_json:
            try:
                config["footer"] = json.loads(footer_json)
            except json.JSONDecodeError:
                config["footer"] = None

        if not config.get("footer"):
            config["footer"] = {
                "title": config_dict.get("footer_title", "Missing a Resource?"),
                "description": config_dict.get(
                    "footer_description",
                    "If you know of an important local resource that should be included on this page, please let us know.",
                ),
                "contactEmail": config_dict.get("footer_contact_email", "contact@example.com"),
                "buttonText": config_dict.get("footer_button_text", "Suggest a Resource"),
            }

        return jsonify(config)
    except Exception as e:
        app.logger.error(f"Error getting resources config: {str(e)}")
        return jsonify({"error": "Failed to load resources configuration"}), 500


@app.route("/api/resources/quick-access", methods=["GET"])
def get_quick_access():
    """Get quick access items for resources page"""
    try:
        items = (
            QuickAccessItem.query.filter_by(is_active=True)
            .order_by(QuickAccessItem.display_order, QuickAccessItem.id)
            .all()
        )
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        app.logger.error(f"Error getting quick access items: {str(e)}")
        return jsonify({"error": "Failed to load quick access items"}), 500


@app.route("/api/resources/items", methods=["GET"])
def get_resource_items():
    """Get resource items, optionally filtered by category"""
    try:
        category = request.args.get("category")
        query = ResourceItem.query.filter_by(is_active=True)

        if category:
            query = query.filter_by(category=category)

        items = query.order_by(
            ResourceItem.category, ResourceItem.display_order, ResourceItem.title
        ).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        app.logger.error(f"Error getting resource items: {str(e)}")
        return jsonify({"error": "Failed to load resource items"}), 500


@app.route("/api/resources/categories", methods=["GET"])
def get_resource_categories():
    """Get unique categories from resource items"""
    try:
        # Get distinct categories from ResourceItem
        result = (
            db.session.query(ResourceItem.category).filter(ResourceItem.is_active).distinct().all()
        )
        categories = [row[0] for row in result if row[0]]
        return jsonify(sorted(categories))
    except Exception as e:
        app.logger.error(f"Error getting resource categories: {str(e)}")
        return jsonify({"error": "Failed to load resource categories"}), 500


@app.route("/api/site-config", methods=["GET"])
def get_site_config():
    """Get site-wide configuration from database"""
    try:
        config_items = ResourceConfig.query.all()
        config_dict = {item.key: item.value for item in config_items}

        return jsonify(
            {
                "site": {
                    "title": config_dict.get("site_title", "Community Website"),
                    "description": config_dict.get(
                        "site_description",
                        "Helping connect people to the resources available to them.",
                    ),
                    "domain": config_dict.get("site_domain", "community.local"),
                    "tagline": config_dict.get("site_tagline", "Community Directory"),
                    "directoryDescription": config_dict.get(
                        "site_directory_description",
                        "Discover local resources and community information.",
                    ),
                    "copyright": config_dict.get("site_copyright", "2025"),
                    "copyrightHolder": config_dict.get("site_copyright_holder", "Community"),
                    "copyrightUrl": config_dict.get("site_copyright_url", "#"),
                    "shortName": config_dict.get("site_short_name", "Community"),
                    "fullName": config_dict.get("site_full_name", "Community Website"),
                }
            }
        )
    except Exception as e:
        app.logger.error(f"Error getting site config: {str(e)}")
        return jsonify({"error": "Failed to load site configuration"}), 500


@app.route("/api/resources", methods=["GET"])
def get_resources():
    """Get complete resources page data in format expected by frontend"""
    try:
        # Get config
        config_response = get_resources_config()
        if config_response.status_code != 200:
            raise Exception("Failed to get config")
        config = config_response.get_json()

        # Get quick access items
        quick_access_response = get_quick_access()
        if quick_access_response.status_code != 200:
            raise Exception("Failed to get quick access")
        quick_access = quick_access_response.get_json()

        # Get resource items
        items_response = get_resource_items()
        if items_response.status_code != 200:
            raise Exception("Failed to get resource items")
        resource_items = items_response.get_json()

        # Format in the expected structure
        result = {
            "site": config["site"],
            "title": config["title"],
            "description": config["description"],
            "quickAccess": quick_access,
            "resources": resource_items,
            "footer": config["footer"],
        }

        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error getting complete resources data: {str(e)}")
        return jsonify({"error": "Failed to load resources data"}), 500


# Admin Resources API endpoints
@app.route("/api/admin/resources/config", methods=["GET"])
@jwt_required()
def admin_get_resource_configs():
    """Get all resource configuration items"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        configs = ResourceConfig.query.all()
        return jsonify([config.to_dict() for config in configs])
    except Exception as e:
        app.logger.error(f"Error getting resource configs: {str(e)}")
        return jsonify({"error": "Failed to load resource configurations"}), 500


@app.route("/api/admin/resources/config/<int:config_id>", methods=["PUT"])
@jwt_required()
def admin_update_resource_config(config_id):
    """Update a resource configuration item"""
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
        app.logger.error(f"Error updating resource config: {str(e)}")
        return jsonify({"error": "Failed to update configuration"}), 500


@app.route("/api/admin/resources/config", methods=["POST"])
@jwt_required()
def admin_create_resource_config():
    """Create a new resource configuration item"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        data = request.get_json()

        # Check if key already exists
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
        app.logger.error(f"Error creating resource config: {str(e)}")
        return jsonify({"error": "Failed to create configuration"}), 500


@app.route("/api/admin/resources/quick-access", methods=["GET"])
@jwt_required()
def admin_get_quick_access_items():
    """Get all quick access items"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        items = QuickAccessItem.query.order_by(
            QuickAccessItem.display_order, QuickAccessItem.id
        ).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        app.logger.error(f"Error getting quick access items: {str(e)}")
        return jsonify({"error": "Failed to load quick access items"}), 500


@app.route("/api/admin/resources/quick-access/<int:item_id>", methods=["GET"])
@jwt_required()
def admin_get_quick_access_item(item_id):
    """Get a single quick access item"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = QuickAccessItem.query.get_or_404(item_id)
        return jsonify(item.to_dict())
    except Exception as e:
        app.logger.error(f"Error getting quick access item: {str(e)}")
        return jsonify({"error": "Failed to load quick access item"}), 500


@app.route("/api/admin/resources/quick-access", methods=["POST"])
@jwt_required()
def admin_create_quick_access_item():
    """Create a new quick access item"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        data = request.get_json()

        # Check if identifier already exists
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
        app.logger.error(f"Error creating quick access item: {str(e)}")
        return jsonify({"error": "Failed to create quick access item"}), 500


@app.route("/api/admin/resources/quick-access/<int:item_id>", methods=["PUT"])
@jwt_required()
def admin_update_quick_access_item(item_id):
    """Update a quick access item"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = QuickAccessItem.query.get_or_404(item_id)
        data = request.get_json()

        # Check if changing identifier would conflict
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
        app.logger.error(f"Error updating quick access item: {str(e)}")
        return jsonify({"error": "Failed to update quick access item"}), 500


@app.route("/api/admin/resources/quick-access/<int:item_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_quick_access_item(item_id):
    """Delete a quick access item"""
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
        app.logger.error(f"Error deleting quick access item: {str(e)}")
        return jsonify({"error": "Failed to delete quick access item"}), 500


@app.route("/api/admin/resources/items", methods=["GET"])
@jwt_required()
def admin_get_resource_items():
    """Get all resource items"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        items = ResourceItem.query.order_by(
            ResourceItem.category, ResourceItem.display_order, ResourceItem.title
        ).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        app.logger.error(f"Error getting resource items: {str(e)}")
        return jsonify({"error": "Failed to load resource items"}), 500


@app.route("/api/admin/resources/items/<int:item_id>", methods=["GET"])
@jwt_required()
def admin_get_resource_item(item_id):
    """Get a single resource item"""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    try:
        item = ResourceItem.query.get_or_404(item_id)
        return jsonify(item.to_dict())
    except Exception as e:
        app.logger.error(f"Error getting resource item: {str(e)}")
        return jsonify({"error": "Failed to load resource item"}), 500


@app.route("/api/admin/resources/items", methods=["POST"])
@jwt_required()
def admin_create_resource_item():
    """Create a new resource item"""
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
        app.logger.error(f"Error creating resource item: {str(e)}")
        return jsonify({"error": "Failed to create resource item"}), 500


@app.route("/api/admin/resources/items/<int:item_id>", methods=["PUT"])
@jwt_required()
def admin_update_resource_item(item_id):
    """Update a resource item"""
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
        app.logger.error(f"Error updating resource item: {str(e)}")
        return jsonify({"error": "Failed to update resource item"}), 500


@app.route("/api/admin/resources/items/<int:item_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_resource_item(item_id):
    """Delete a resource item"""
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
        app.logger.error(f"Error deleting resource item: {str(e)}")
        return jsonify({"error": "Failed to delete resource item"}), 500


@app.route("/api/search", methods=["GET"])
def search_resources():
    """Search the indexed resources using OpenSearch"""
    try:
        query = request.args.get("q", "").strip()
        if not query:
            return jsonify({"error": "Query parameter q is required"}), 400

        # Pagination parameters
        page = int(request.args.get("page", 1))
        size = int(request.args.get("size", 20))

        # Validate pagination parameters
        if page < 1:
            page = 1
        if size < 1 or size > 100:  # Limit max size to 100
            size = 20

        # Calculate offset
        offset = (page - 1) * size

        # Index name based on namespace
        index_name = f"{namespace}-resources"

        # Perform search
        search_body = {
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["title^3", "description^2", "content", "category"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            },
            "highlight": {
                "fields": {
                    "title": {},
                    "description": {},
                    "content": {"fragment_size": 150, "number_of_fragments": 2},
                }
            },
            "from": offset,
            "size": size,
        }

        response = opensearch_client.search(index=index_name, body=search_body)

        # Format results
        results = []
        for hit in response["hits"]["hits"]:
            source = hit["_source"]

            # Create content excerpt from the content field
            content_excerpt = ""
            if source.get("content"):
                content_text = source["content"]
                # Take first 400 characters as excerpt for more detailed content
                if len(content_text) > 400:
                    content_excerpt = content_text[:400] + "..."
                else:
                    content_excerpt = content_text

            # Use page description as primary description, fall back to resource description
            display_description = source.get("page_description") or source.get("description", "")

            result = {
                "id": source["resource_id"],
                "title": source["title"],
                "description": display_description,
                "content_excerpt": content_excerpt,
                "url": source["url"],
                "page_url": source.get(
                    "page_url", source["url"]
                ),  # Use page_url if available, fallback to main url
                "category": source["category"],
                "phone": source.get("phone", ""),
                "address": source.get("address", ""),
                "domain": source["domain"],
                "score": hit["_score"],
                "is_homepage": source.get("is_homepage", True),
            }

            # Add highlights if available
            if "highlight" in hit:
                result["highlights"] = hit["highlight"]

            results.append(result)

        total_hits = response["hits"]["total"]["value"]
        total_pages = (total_hits + size - 1) // size  # Ceiling division

        return jsonify(
            {
                "query": query,
                "total": total_hits,
                "page": page,
                "size": size,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
                "results": results,
            }
        )

    except Exception as e:
        # If index doesn't exist or other error, return empty results
        return jsonify(
            {
                "query": query if "query" in locals() else "",
                "total": 0,
                "results": [],
                "error": str(e),
            }
        )


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    # Only bind to 0.0.0.0 in production (container), use localhost for development
    host = "0.0.0.0" if os.getenv("FLASK_ENV") == "production" else "127.0.0.1"
    app.run(host=host, port=5000, debug=os.getenv("FLASK_DEBUG", "False").lower() == "true")
