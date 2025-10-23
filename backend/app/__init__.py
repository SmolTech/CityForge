import os
from datetime import timedelta

from flask import Flask
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from opensearchpy import OpenSearch

from app.config import Config

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
bcrypt = Bcrypt()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)
opensearch_client = None


def create_app():
    app = Flask(__name__)

    # CORS configuration to support credentials (cookies)
    CORS(
        app,
        supports_credentials=True,
        origins=[
            "http://localhost:3000",  # Development frontend
            "http://localhost:5000",  # Development backend
            os.getenv("FRONTEND_URL", ""),  # Production frontend
        ],
    )

    # Configure logging
    from app.utils.logging_config import configure_logging

    configure_logging(app)

    # Determine environment (default to development if not specified)
    flask_env = os.getenv("FLASK_ENV", "development").lower()
    is_production = flask_env == "production"

    # Configuration
    app.config["JWT_SECRET_KEY"] = os.getenv(
        "JWT_SECRET_KEY", "dev-secret-key-change-in-production"
    )
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=Config.ACCESS_TOKEN_EXPIRES_DAYS)

    # JWT Cookie Configuration (httpOnly cookies for security)
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_COOKIE_SECURE"] = is_production  # HTTPS only in production
    app.config["JWT_COOKIE_HTTPONLY"] = True  # Prevents JavaScript access
    app.config["JWT_COOKIE_SAMESITE"] = "Lax"  # CSRF protection
    app.config["JWT_COOKIE_CSRF_PROTECT"] = (
        False  # Disabled for now (can enable later with CSRF tokens)
    )
    app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token"
    app.config["JWT_COOKIE_DOMAIN"] = None  # Same domain only

    app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "uploads")
    app.config["MAX_CONTENT_LENGTH"] = Config.MAX_FILE_SIZE

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

    # SQLAlchemy connection pool configuration
    # Configure connection pool based on environment
    pool_config = {
        # Test connections before using (detects broken connections)
        "pool_pre_ping": True,
        # Recycle connections after 1 hour to prevent stale connections
        "pool_recycle": Config.POOL_RECYCLE_SECONDS,
        # Timeout waiting for connection from pool (seconds)
        "pool_timeout": Config.POOL_TIMEOUT_SECONDS,
    }

    if is_production:
        # Production: larger pool for higher traffic
        pool_config.update(
            {
                "pool_size": Config.POOL_SIZE_PRODUCTION,
                "max_overflow": Config.MAX_OVERFLOW_PRODUCTION,
            }
        )
    else:
        # Development: smaller pool to conserve resources
        pool_config.update(
            {
                "pool_size": Config.POOL_SIZE_DEVELOPMENT,
                "max_overflow": Config.MAX_OVERFLOW_DEVELOPMENT,
            }
        )

    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = pool_config

    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    limiter.init_app(app)

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
        from app.models.token_blacklist import TokenBlacklist

        jti = jwt_payload["jti"]
        return TokenBlacklist.is_jti_blacklisted(jti)

    @jwt.user_identity_loader
    def user_identity_lookup(user):
        return str(user)

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        from app.models.user import User

        identity = jwt_data["sub"]
        user = User.query.filter_by(id=int(identity)).one_or_none()
        # Return None if user is inactive to prevent authentication
        if user and not user.is_active:
            return None
        return user

    # Register blueprints
    from app.routes import (
        admin,
        auth,
        cards,
        forums,
        help_wanted,
        resources,
        reviews,
        search,
        upload,
    )

    app.register_blueprint(auth.bp)
    app.register_blueprint(cards.bp)
    app.register_blueprint(resources.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(search.bp)
    app.register_blueprint(upload.bp)
    app.register_blueprint(help_wanted.bp)
    app.register_blueprint(reviews.bp)
    app.register_blueprint(forums.bp)

    # Register error handlers
    from app.utils.errors import register_error_handlers

    register_error_handlers(app)

    # Custom rate limit error handler
    @app.errorhandler(429)
    def ratelimit_handler(e):
        from flask import jsonify

        return (
            jsonify(
                {
                    "error": {
                        "message": "Rate limit exceeded. Please try again later.",
                        "code": 429,
                        "details": {"description": str(e.description)},
                    }
                }
            ),
            429,
        )

    # Health check
    @app.route("/health", methods=["GET"])
    def health_check():
        from flask import jsonify

        return jsonify({"status": "healthy", "service": "community-backend"})

    return app
