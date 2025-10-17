# CityForge Backend Application

## Overview

The CityForge backend is a Flask-based REST API that provides services for a community website platform. The application follows a modular architecture using Flask blueprints and the application factory pattern.

## Table of Contents

- [Architecture](#architecture)
- [Application Factory](#application-factory)
- [Configuration](#configuration)
- [Extensions](#extensions)
- [JWT Authentication](#jwt-authentication)
- [Database](#database)
- [Routes & Blueprints](#routes--blueprints)
- [Health Check](#health-check)
- [Running the Application](#running-the-application)

## Architecture

The application uses the **Application Factory Pattern** to create flexible, testable Flask applications. The main application factory is located in `app/__init__.py`.

### Directory Structure

```
backend/
├── app/
│   ├── __init__.py          # Application factory & configuration
│   ├── models/              # SQLAlchemy database models
│   ├── routes/              # Flask blueprints for API endpoints
│   └── helpers/             # Utility functions
├── wsgi.py                  # WSGI entry point
├── init_db.py              # Database initialization script
└── tests/                   # Test suite
```

## Application Factory

### `create_app()`

The `create_app()` function is the application factory that creates and configures a Flask application instance.

**Location:** `app/__init__.py`

**Returns:** Configured Flask application instance

**Usage:**

```python
from app import create_app

app = create_app()
```

### Initialization Steps

1. **Create Flask app instance**
2. **Enable CORS** for cross-origin requests
3. **Load configuration** from environment variables
4. **Initialize extensions** (database, JWT, bcrypt, OpenSearch)
5. **Configure JWT callbacks** for authentication
6. **Register blueprints** for API routes
7. **Create upload directory** if it doesn't exist
8. **Register health check endpoint**

## Configuration

The application is configured using environment variables for security and flexibility.

### Environment Variables

| Variable            | Default                               | Description                          |
| ------------------- | ------------------------------------- | ------------------------------------ |
| `JWT_SECRET_KEY`    | `dev-secret-key-change-in-production` | Secret key for JWT token signing     |
| `DATABASE_URL`      | Generated from components             | Full PostgreSQL connection URL       |
| `POSTGRES_USER`     | `postgres`                            | Database username                    |
| `POSTGRES_PASSWORD` | `postgres`                            | Database password                    |
| `POSTGRES_HOST`     | `localhost`                           | Database host                        |
| `POSTGRES_PORT`     | `5432`                                | Database port                        |
| `POSTGRES_DB`       | `community_db`                        | Database name                        |
| `OPENSEARCH_HOST`   | `opensearch-service`                  | OpenSearch host                      |
| `OPENSEARCH_PORT`   | `9200`                                | OpenSearch port                      |
| `UPLOAD_FOLDER`     | `uploads`                             | Directory for file uploads           |
| `FLASK_ENV`         | -                                     | Environment (production/development) |
| `FLASK_DEBUG`       | `False`                               | Enable debug mode                    |

### Database URL Construction

The application supports two methods for database configuration:

1. **Direct URL** (recommended for production):

   ```bash
   DATABASE_URL=postgresql://user:pass@host:port/dbname
   ```

2. **Component-based** (development):
   ```bash
   POSTGRES_USER=myuser
   POSTGRES_PASSWORD=mypass
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=mydb
   ```

**Note:** The application automatically converts `postgresql://` URLs to use the `psycopg` driver (`postgresql+psycopg://`).

### Flask Configuration

```python
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)  # JWT token validity
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024        # 16MB max upload
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False        # Disable FSA tracking
```

## Extensions

The application uses several Flask extensions that are initialized globally and then bound to the application in the factory.

### SQLAlchemy (`db`)

**Purpose:** ORM for database operations

**Initialization:**

```python
from app import db

# Define models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # ...

# Query
users = User.query.filter_by(email=email).first()
```

### JWT Manager (`jwt`)

**Purpose:** JSON Web Token authentication

**Configuration:**

- Access token expires in 7 days
- Token revocation via database blacklist
- User identity stored as string ID

### Bcrypt (`bcrypt`)

**Purpose:** Password hashing

**Usage:**

```python
from app import bcrypt

hashed = bcrypt.generate_password_hash(password).decode('utf-8')
is_valid = bcrypt.check_password_hash(hashed, password)
```

### OpenSearch Client (`opensearch_client`)

**Purpose:** Full-text search functionality

**Configuration:**

- Connects to OpenSearch instance
- No authentication (internal network)
- SSL disabled for development

**Usage:**

```python
from app import opensearch_client

results = opensearch_client.search(index="cards", body=query)
```

## JWT Authentication

The application implements a comprehensive JWT authentication system with token revocation.

### JWT Callbacks

#### 1. Token Revocation Check

```python
@jwt.token_in_blocklist_loader
def check_if_token_revoked(_jwt_header, jwt_payload):
    from app.models.token_blacklist import TokenBlacklist

    jti = jwt_payload["jti"]
    return TokenBlacklist.is_jti_blacklisted(jti)
```

**Purpose:** Check if a token has been revoked (blacklisted)

**How it works:**

- Extracts JTI (JWT ID) from token payload
- Queries the `token_blacklist` table
- Returns `True` if token is blacklisted

#### 2. User Identity Loader

```python
@jwt.user_identity_loader
def user_identity_lookup(user):
    return str(user)
```

**Purpose:** Convert user object/ID to string for JWT subject

#### 3. User Lookup Loader

```python
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    from app.models.user import User

    identity = jwt_data["sub"]
    return User.query.filter_by(id=int(identity)).one_or_none()
```

**Purpose:** Load user object from JWT payload

**Usage in routes:**

```python
from flask_jwt_extended import jwt_required, current_user

@bp.route("/protected")
@jwt_required()
def protected_route():
    # current_user is automatically loaded
    return {"user": current_user.to_dict()}
```

### Token Flow

1. **Login:** User provides credentials → receives JWT access token
2. **Authentication:** Client sends token in `Authorization: Bearer <token>` header
3. **Validation:** JWT manager validates signature and expiration
4. **Revocation Check:** System checks if JTI is in blacklist
5. **User Loading:** User object loaded from database
6. **Logout:** Token JTI added to blacklist table

### Token Blacklist

When a user logs out, their token is added to the `token_blacklist` table:

```python
TokenBlacklist.add_token_to_blacklist(
    jti=jwt_data["jti"],
    token_type="access",
    user_id=user_id,
    expires_at=expiration_time
)
```

Expired tokens are cleaned up by a scheduled job (see `cleanup_expired_tokens.py`).

## Database

### Database Driver

The application uses **psycopg 3** (modern PostgreSQL adapter) via SQLAlchemy.

### Connection URL Format

```
postgresql+psycopg://username:password@host:port/database
```

### Key Models

Located in `app/models/`:

- **User** - User accounts and authentication
- **Card** - Business directory entries
- **Tag** - Categorization tags
- **CardSubmission** - User-submitted entries pending approval
- **CardModification** - Suggested edits to existing entries
- **TokenBlacklist** - Revoked JWT tokens
- **ResourceItem** - Community resource listings
- **ResourceConfig** - Site configuration key-value pairs
- **QuickAccessItem** - Quick access links (emergency services, etc.)
- **Review** - Business reviews and ratings
- **ForumCategory** - Forum categories
- **ForumThread** - Forum discussion threads
- **ForumPost** - Forum posts
- **HelpWantedPost** - Job/collaboration posts

### Migrations

The application handles schema migrations through the `init_db.py` script, which:

- Creates all tables if they don't exist
- Runs schema migrations for existing databases
- Is idempotent (safe to run multiple times)

## Routes & Blueprints

The API is organized into modular blueprints:

### Registered Blueprints

| Blueprint     | Prefix             | Module                   | Description                      |
| ------------- | ------------------ | ------------------------ | -------------------------------- |
| `auth`        | `/api/auth`        | `app.routes.auth`        | Authentication & user management |
| `cards`       | `/api/cards`       | `app.routes.cards`       | Business directory               |
| `resources`   | `/api/resources`   | `app.routes.resources`   | Community resources              |
| `admin`       | `/api/admin`       | `app.routes.admin`       | Admin operations                 |
| `search`      | `/api/search`      | `app.routes.search`      | OpenSearch integration           |
| `upload`      | `/api/upload`      | `app.routes.upload`      | File uploads                     |
| `help_wanted` | `/api/help-wanted` | `app.routes.help_wanted` | Job/collaboration board          |
| `reviews`     | `/api/reviews`     | `app.routes.reviews`     | Business reviews                 |
| `forums`      | `/api/forums`      | `app.routes.forums`      | Discussion forums                |

### Blueprint Registration

Blueprints are registered in order:

```python
app.register_blueprint(auth.bp)
app.register_blueprint(cards.bp)
app.register_blueprint(resources.bp)
app.register_blueprint(admin.bp)
app.register_blueprint(search.bp)
app.register_blueprint(upload.bp)
app.register_blueprint(help_wanted.bp)
app.register_blueprint(reviews.bp)
app.register_blueprint(forums.bp)
```

### Example: Authentication Routes

```python
# app/routes/auth.py
from flask import Blueprint

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@bp.route("/login", methods=["POST"])
def login():
    # Login logic
    pass

@bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    # Logout logic
    pass
```

## Health Check

The application provides a health check endpoint for monitoring and orchestration tools.

### Endpoint

```
GET /health
```

### Response

```json
{
  "status": "healthy",
  "service": "community-backend"
}
```

### Usage

**Kubernetes Liveness Probe:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 10
```

**Docker Healthcheck:**

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:5000/health || exit 1
```

## Running the Application

### Development Mode

**Using wsgi.py:**

```bash
cd backend
python wsgi.py
```

**Using Flask CLI:**

```bash
cd backend
export FLASK_APP=wsgi.py
export FLASK_DEBUG=True
flask run --host=127.0.0.1 --port=5000
```

### Production Mode

**Using Gunicorn (recommended):**

```bash
cd backend
gunicorn --bind 0.0.0.0:5000 --workers 4 wsgi:app
```

**Environment variables:**

```bash
export FLASK_ENV=production
export JWT_SECRET_KEY=your-secret-key-here
export DATABASE_URL=postgresql://user:pass@host:port/dbname
```

### Docker

The application is containerized and can be run with:

```bash
docker build -t cityforge-backend .
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET_KEY=... \
  cityforge-backend
```

### Kubernetes

Deploy using kustomize:

```bash
kubectl apply -k k8s/
```

See `k8s/backend-deployment.yaml` for configuration.

## Initialization

### First-Time Setup

1. **Set environment variables:**

   ```bash
   export POSTGRES_USER=myuser
   export POSTGRES_PASSWORD=mypass
   export POSTGRES_DB=mydb
   export JWT_SECRET_KEY=your-secret-key
   ```

2. **Initialize database:**

   ```bash
   python init_db.py
   ```

   This will:
   - Create all database tables
   - Prompt for admin credentials
   - Set up default configuration
   - Create sample resources

3. **Run the application:**
   ```bash
   python wsgi.py
   ```

### Testing

Run the test suite:

```bash
# All tests
./run_tests.sh

# Unit tests only
pytest tests/unit/

# With coverage
pytest --cov=app tests/
```

## Security Considerations

### Production Checklist

- [ ] Change `JWT_SECRET_KEY` from default value
- [ ] Use strong database passwords
- [ ] Enable HTTPS/TLS
- [ ] Set `FLASK_ENV=production`
- [ ] Disable `FLASK_DEBUG`
- [ ] Configure proper CORS origins
- [ ] Use environment-specific OpenSearch credentials
- [ ] Enable database SSL connections
- [ ] Implement rate limiting
- [ ] Set up logging and monitoring

### JWT Security

- Tokens expire after 7 days (configurable)
- Revoked tokens are tracked in database
- Token blacklist cleanup runs daily
- JTI (JWT ID) ensures token uniqueness

### Database Security

- Passwords hashed with bcrypt (cost factor 12)
- SQL injection prevented by SQLAlchemy ORM
- Connection strings support SSL/TLS
- Prepared statements used throughout

## Troubleshooting

### Common Issues

**Database connection fails:**

- Check `DATABASE_URL` or PostgreSQL environment variables
- Verify database is running: `pg_isready -h localhost -p 5432`
- Ensure database exists: `psql -l`

**OpenSearch connection fails:**

- Check `OPENSEARCH_HOST` and `OPENSEARCH_PORT`
- Verify OpenSearch is running: `curl http://localhost:9200`

**JWT tokens not working:**

- Check `JWT_SECRET_KEY` is set consistently
- Verify token hasn't expired (7 day default)
- Check if token is blacklisted in database

**Upload directory issues:**

- Application creates `uploads/` directory automatically
- Ensure write permissions: `chmod 755 uploads/`
- Check `UPLOAD_FOLDER` environment variable

### Debug Mode

Enable detailed logging:

```bash
export FLASK_DEBUG=True
python wsgi.py
```

### Database Inspection

```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Check token blacklist
SELECT * FROM token_blacklist LIMIT 10;
```

## API Documentation

For detailed API endpoint documentation, see:

- `CLAUDE.md` - Overview of all routes
- Individual route files in `app/routes/`
- OpenAPI/Swagger documentation (if configured)

## Contributing

When adding new features:

1. Create models in `app/models/`
2. Create routes in `app/routes/`
3. Register blueprints in `app/__init__.py`
4. Add tests in `tests/`
5. Update documentation

## Additional Resources

- [Flask Documentation](https://flask.palletsprojects.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Flask-JWT-Extended Documentation](https://flask-jwt-extended.readthedocs.io/)
- [OpenSearch Documentation](https://opensearch.org/docs/)
