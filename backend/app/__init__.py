import os
from datetime import timedelta

from flask import Flask
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from opensearchpy import OpenSearch

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()
opensearch_client = None

# JWT token blacklist (in production, use Redis or database)
blacklisted_tokens = set()


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Configuration
    app.config["JWT_SECRET_KEY"] = os.getenv(
        "JWT_SECRET_KEY", "dev-secret-key-change-in-production"
    )
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
        # Use psycopg3 driver explicitly
        database_url = f"postgresql+psycopg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    # Handle DATABASE_URL that might use generic postgresql://
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Initialize extensions with app
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)

    # OpenSearch configuration
    global opensearch_client
    opensearch_host = os.getenv("OPENSEARCH_HOST", "opensearch-service")
    opensearch_port = int(os.getenv("OPENSEARCH_PORT", "9200"))

    opensearch_client = OpenSearch(
        hosts=[{"host": opensearch_host, "port": opensearch_port}],
        http_auth=None,
        use_ssl=False,
        verify_certs=False,
        connection_class=None,
    )

    # Ensure upload directory exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # JWT callbacks
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(_jwt_header, jwt_payload):
        return jwt_payload["jti"] in blacklisted_tokens

    @jwt.user_identity_loader
    def user_identity_lookup(user):
        return str(user)

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        from app.models.user import User

        identity = jwt_data["sub"]
        return User.query.filter_by(id=int(identity)).one_or_none()

    # Register blueprints
    from app.routes import admin, auth, cards, help_wanted, resources, search, upload

    app.register_blueprint(auth.bp)
    app.register_blueprint(cards.bp)
    app.register_blueprint(resources.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(search.bp)
    app.register_blueprint(upload.bp)
    app.register_blueprint(help_wanted.bp)

    # Health check
    @app.route("/health", methods=["GET"])
    def health_check():
        from flask import jsonify

        return jsonify({"status": "healthy", "service": "community-backend"})

    return app


# For gunicorn, import and create app in app.py instead
