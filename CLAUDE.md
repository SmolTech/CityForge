# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CityForge is a full-stack community website platform built with Next.js 15 and a Python Flask backend. The application features a business directory, resource directory, community submissions, and search functionality. Docker images are built via GitHub Actions and pushed to GitHub Container Registry.

## Architecture

The project is structured as a three-component application:

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS v4, and app router
- **Backend**: Python Flask API with SQLAlchemy ORM and PostgreSQL database
- **Indexer**: Python service that indexes business card websites into OpenSearch for full-text search
- **Infrastructure**: Docker containers with automated builds via GitHub Actions

### Key Components

- **Frontend App** (`src/app/`): Next.js pages for business directory, resources, admin dashboard, authentication, and search
- **Backend API** (`backend/`): Flask application providing REST APIs for cards, resources, auth, admin, and search
- **Indexer** (`indexer/`): Python script that crawls business websites and indexes content into OpenSearch
- **Database Models**: PostgreSQL schemas for users, cards, tags, submissions, and resources
- **GitHub Actions** (`.github/workflows/`): Automated Docker image builds for all components

## Development Commands

### Frontend Development

```bash
# Development server with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm start

# Code quality
npm run lint          # ESLint check
npm run lint:fix      # ESLint with auto-fix
npm run format        # Prettier formatting
npm run format:check  # Prettier check only
npm run typecheck     # TypeScript validation
```

### Backend Development

```bash
# From backend/ directory
pip install -r requirements.txt

# Initialize database (prompts for admin email and password)
python init_db.py

# Development server
python app/__init__.py  # Runs on port 5000

# Run tests
./run_tests.sh
pytest

# Production deployment uses gunicorn
gunicorn --bind 0.0.0.0:5000 --workers 4 app:app
```

### Indexer Development

```bash
# From indexer/ directory
pip install -r requirements.txt

# Run indexer (requires OpenSearch and backend API to be running)
python indexer.py
```

### Docker & Deployment

Docker images are automatically built and pushed to GitHub Container Registry when code is pushed to `main` or `develop` branches:

- `ghcr.io/smoltech/cityforge/cityforge-frontend`
- `ghcr.io/smoltech/cityforge/cityforge-backend`
- `ghcr.io/smoltech/cityforge/cityforge-indexer`

```bash
# Manual Docker builds for local testing
docker build -t cityforge-frontend .
docker build -t cityforge-backend ./backend
docker build -t cityforge-indexer ./indexer
```

## Code Quality & Git Hooks

The project enforces code quality through automated git hooks:

- **Pre-commit**: Runs `lint-staged` (ESLint + Prettier on staged files)
- **Pre-push**: Runs `npm run typecheck`, `npm run lint`, and `npm run build`

## Key Development Notes

### Database Migrations

The project uses **Flask-Migrate** (Alembic wrapper) for database schema version control and migrations.

#### Migration Workflow

**After making model changes:**

```bash
cd backend
export FLASK_APP=app:create_app

# Generate migration from model changes
flask db migrate -m "Description of changes"

# Review the generated migration file in migrations/versions/

# Apply migration to database
flask db upgrade

# To rollback last migration
flask db downgrade
```

#### Common Migration Commands

```bash
# View current migration version
flask db current

# View migration history
flask db history

# Upgrade to specific version
flask db upgrade <revision>

# Downgrade to specific version
flask db downgrade <revision>

# Show SQL without executing
flask db upgrade --sql
```

#### Deployment

**Docker Compose:**
Migrations run automatically on container startup via:

```bash
flask db upgrade && gunicorn ...
```

**Kubernetes:**

Migrations run automatically via init container before backend pods start:

- Init container runs `flask db upgrade`
- Main container starts only after successful migration
- See: `k8s/backend-deployment.yaml`

**Manual Migration Job (Kubernetes):**

```bash
kubectl apply -f k8s/migration-job.yaml
kubectl logs job/db-migration -n community
```

#### Migration Best Practices

1. **Always review** generated migrations before committing
2. **Test migrations** on a copy of production data
3. **Backup database** before running migrations in production
4. **Never edit** applied migrations - create new ones instead
5. **Commit migrations** to version control with your model changes

#### Database Initialization (Legacy)

For **new deployments only**, the `init_db.py` script can create initial tables:

```bash
cd backend
python init_db.py
# Prompts for admin email and password

```

**Important**:

- Use `flask db upgrade` for existing databases
- `init_db.py` drops all tables - **never run in production**
- The script is kept for reference and testing only

### Database Schema

The Flask backend defines the following main models:

**Core Models:**

- `User`: User authentication and authorization (admin/user roles)
- `Card`: Business cards in the directory (name, description, contact info, tags, images)
- `Tag`: Tags for categorizing cards
- `CardSubmission`: User-submitted cards pending admin approval
- `CardModification`: User-suggested edits to existing cards
- `TokenBlacklist`: Revoked JWT tokens (logout implementation)

**Resource Models:**

- `ResourceCategory`: Categories for the resource directory
- `ResourceItem`: Items in the resource directory
- `QuickAccessItem`: Featured quick-access items
- `ResourceConfig`: Site-wide configuration values

### Database Connection Pooling

The application uses SQLAlchemy's connection pooling with optimized settings for production reliability:

**Configuration** (`backend/app/__init__.py`):

The connection pool is configured automatically based on the `FLASK_ENV` environment variable:

**Development Settings** (default):

```python
pool_size: 5          # Maximum connections in pool
max_overflow: 10      # Additional connections beyond pool_size
pool_recycle: 3600    # Recycle connections after 1 hour
pool_pre_ping: True   # Test connections before using
pool_timeout: 30      # Timeout waiting for connection (seconds)
```

**Production Settings** (`FLASK_ENV=production`):

```python
pool_size: 10         # Larger pool for higher traffic
max_overflow: 20      # More overflow connections
pool_recycle: 3600    # Recycle connections after 1 hour
pool_pre_ping: True   # Test connections before using
pool_timeout: 30      # Timeout waiting for connection (seconds)
```

**Key Features:**

- **pool_pre_ping**: Detects and recovers from broken database connections automatically
- **pool_recycle**: Prevents MySQL "has gone away" errors by recycling stale connections
- **Environment-based sizing**: Smaller pools in development to conserve resources, larger in production for traffic
- **Connection timeout**: Prevents indefinite waits when pool is exhausted

**Setting Environment for Production:**

```bash
export FLASK_ENV=production
# Then start the application
gunicorn --bind 0.0.0.0:5000 --workers 4 app:app
```

**Docker/Kubernetes:**

Set the environment variable in your deployment configuration:

```yaml
env:
  - name: FLASK_ENV
    value: "production"
```

**Monitoring Pool Usage:**

To enable detailed connection pool logging for debugging:

```python
import logging
logging.basicConfig()
logging.getLogger('sqlalchemy.pool').setLevel(logging.DEBUG)
```

### JWT Token Management

The application uses database-backed JWT token blacklisting for secure logout:

- When users log out, their tokens are added to the `token_blacklist` table
- Tokens are checked against the blacklist on every authenticated request
- Expired tokens are automatically cleaned up by a Kubernetes CronJob

**Kubernetes Deployment:**
The token cleanup runs automatically as a CronJob (see `k8s/token-cleanup-cronjob.yaml`):

- Runs daily at 3 AM Eastern Time
- Uses the backend Docker image
- Connects to the database to remove expired tokens
- Resource limits: 256Mi memory, 200m CPU

**Manual Cleanup (Local Development):**

```bash
cd backend
python cleanup_expired_tokens.py
```

**Traditional Cron (Non-Kubernetes):**

```bash
0 3 * * * cd /path/to/backend && python cleanup_expired_tokens.py
```

### API Rate Limiting

The backend implements Flask-Limiter for API rate limiting to protect against:

- Brute force attacks on authentication endpoints
- Resource exhaustion (DoS)
- Spam submissions
- Account enumeration

#### Rate Limits by Endpoint Type

**Authentication:**

- **Login** (`/api/auth/login`): 5 requests per minute
- **Registration** (`/api/auth/register`): 3 requests per hour
- **Email update** (`/api/auth/update-email`): 5 requests per hour
- **Password update** (`/api/auth/update-password`): 5 requests per hour

**Public API Reads:**

- **Card listing** (`/api/cards`): 100 requests per minute
- **Search** (`/api/search`): 60 requests per minute

**User Submissions:**

- **Card submissions** (`/api/submissions`): 10 requests per hour
- **Suggest edits** (`/api/cards/<id>/suggest-edit`): 10 requests per hour
- **File uploads** (`/api/upload`): 20 requests per hour

**Default Limits:**

- All other endpoints: 200 requests per day, 50 per hour

#### Rate Limit Responses

When rate limit is exceeded, the API returns:

```json
{
  "error": {
    "message": "Rate limit exceeded. Please try again later.",
    "code": 429,
    "details": {
      "description": "5 per 1 minute"
    }
  }
}
```

#### Storage

Rate limits use in-memory storage (`memory://`) for simplicity. For production deployments with multiple backend instances, consider using Redis:

```python
# backend/app/__init__.py
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="redis://redis-host:6379"
)
```

### API Endpoints

**Public APIs:**

- `/api/cards` - Business directory (GET with filtering by tag)
- `/api/cards/<id>` - Individual card details
- `/api/business/<id>` - Business card by ID with slug support
- `/api/tags` - Available tags
- `/api/submissions` - Submit new cards (POST)
- `/api/cards/<id>/suggest-edit` - Suggest edits to existing cards (POST)
- `/api/search` - Full-text search via OpenSearch
- `/api/resources/*` - Resource directory endpoints
- `/api/site-config` - Site configuration
- `/api/upload` - File uploads

**Auth APIs:**

- `/register` - User registration
- `/login` - User login
- `/logout` - User logout
- `/me` - Current user info
- `/update-email`, `/update-password`, `/update-profile` - User account management

**Admin APIs** (require admin role):

- `/admin/cards/*` - CRUD operations for cards
- `/admin/submissions/*` - Approve/reject card submissions
- `/admin/modifications/*` - Approve/reject card edit suggestions
- `/admin/users/*` - User management
- `/admin/tags/*` - Tag management
- `/admin/resources/*` - Resource directory management

### Frontend Structure

Uses Next.js 15 app router with the following pages:

- `/` - Homepage
- `/business` - Business directory
- `/resources` - Resource directory
- `/search` - Search interface
- `/submit` - Submit new business card
- `/login`, `/register` - Authentication
- `/dashboard` - User dashboard
- `/settings` - User settings
- `/admin` - Admin dashboard (admin users only)
- `/forums/*` - Community forums (requires authentication)

**Forum Pages (Authentication Required):**

- `/forums` - Forum categories list
- `/forums/[categorySlug]` - Category threads
- `/forums/[categorySlug]/[threadId]` - Thread details and posts
- `/forums/[categorySlug]/new` - Create new thread
- `/forums/request-category` - Request new forum category

**Authentication Enforcement:**
All forum pages check authentication on mount and redirect unauthenticated users to `/login?redirect=[original-url]`. This allows users to return to their intended destination after logging in.

### Configuration Management

The frontend uses React Context API to manage and share site configuration across all components:

**ConfigContext** (`src/contexts/ConfigContext.tsx`):

- Loads configuration once on app mount from `/api/config`
- Provides centralized access to site configuration via `useConfig()` hook
- Includes fallback configuration if API fetch fails

- Eliminates duplicate API calls across components

**Usage in components:**

```tsx
import { useConfig } from "@/contexts/ConfigContext";

function MyComponent() {
  const config = useConfig();
  const siteConfig = config.site;

  return <h1>{siteConfig.title}</h1>;
}
```

**Configuration structure:**

- `site`: Site-wide settings (title, description, copyright, etc.)
- `resources`: Resource directory configuration
- `quickAccess`: Quick access items for resources page
- `resourceItems`: Resource directory items
- `footer`: Footer configuration
- `pagination`: Pagination settings (defaultLimit)

**Important**: Always use `useConfig()` hook instead of directly fetching `/api/config` to avoid redundant API calls.

### Pagination Configuration

The application supports configurable pagination limits via the site configuration system:

**Default Behavior:**

- Default pagination limit: **20 items per page**
- Configurable via `ResourceConfig` table with key `pagination_default_limit`
- Automatically loaded from backend and available in frontend via `useConfig().pagination.defaultLimit`

**Setting Custom Pagination Limit:**

**Option 1: Via Admin UI (Recommended)**

1. Login as an admin user
2. Navigate to Site Settings (`/site-config`)
3. Find "Items Per Page" in the "Pagination & Display" section
4. Set desired value (5-100)
5. Click "Save All Changes"

**Option 2: Direct Database Update**

```sql
INSERT INTO resource_config (key, value, description)
VALUES ('pagination_default_limit', '30', 'Default number of items per page in directory listings')
ON CONFLICT (key) DO UPDATE SET value = '30';
```

Changes take effect after cache expires (10 minutes) or immediately with a hard refresh.

**Frontend Usage:**

```tsx
import { useConfig } from "@/contexts/ConfigContext";

function MyPage() {
  const config = useConfig();
  const itemsPerPage = config.pagination.defaultLimit; // Uses configured value

  // Use in pagination logic
  const offset = (currentPage - 1) * itemsPerPage;
}
```

**Backend API Response:**

The `/api/site-config` endpoint returns:

```json
{
  "site": { ... },
  "pagination": {
    "defaultLimit": 20
  }
}
```

### API Response Caching

The application implements multi-layer caching to improve performance and reduce server load:

#### Backend Cache Headers (Flask)

Flask routes set HTTP cache headers using `Cache-Control`:

**Cache Durations:**

- **Tags** (`/api/tags`): 5 minutes (300s)
- **Site Config** (`/api/site-config`): 10 minutes (600s)
- **Cards List** (`/api/cards`): 1 minute (60s)
- **Individual Card** (`/api/cards/<id>`, `/api/business/<id>`): 5 minutes (300s)
- **Resources** (`/api/resources`): 5 minutes (300s)

**Implementation:**

```python
response = jsonify(data)
response.headers["Cache-Control"] = "public, max-age=300"
return response
```

**Important**: User-specific endpoints (auth, submissions, dashboard) are NOT cached to ensure fresh data.

#### Frontend Caching (Next.js)

The API client (`src/lib/api/client.ts`) implements Next.js fetch caching with `revalidate`:

**Caching Strategy:**

- Only caches GET requests
- Skips caching for authenticated requests (user-specific data)
- Automatically applies appropriate cache duration based on endpoint

**Next.js API Route** (`src/app/api/config/route.ts`):

- Uses `revalidate: 300` for 5-minute cache
- Implements `stale-while-revalidate` pattern for better UX
- Falls back to default config if backend is unavailable

#### Benefits

- **Faster Page Loads**: Cached responses served from browser/CDN
- **Reduced Server Load**: Fewer database queries for frequently accessed data
- **Better Offline Support**: Stale content served while revalidating
- **Improved Scalability**: CDN can serve cached responses

#### Cache Invalidation

- **Time-Based**: Automatic expiration based on `max-age`
- **Manual**: Admin actions (creating/editing cards) don't trigger automatic invalidation
- **Browser**: Users can hard-refresh (Ctrl+Shift+R) to bypass cache

**Note**: For production with multiple backend instances, consider implementing cache invalidation via Redis pub/sub or database triggers.

### Styling

- Tailwind CSS v4 with custom configuration
- Geist fonts (sans and mono variants)
- Responsive design with dark mode support

### Search Functionality

The indexer component (`indexer/indexer.py`) provides full-text search with error recovery capabilities:

**Features:**

- Crawls business card websites (respects robots.txt)
- Discovers and parses sitemaps
- Indexes content into OpenSearch
- Supports multi-page indexing per business
- **Database-backed progress tracking** for error recovery
- **Automatic resume** after crashes or interruptions
- **Retry logic** for failed indexing jobs (max 3 attempts)
- Runs as a scheduled job or on-demand

**Progress Tracking:**

The indexer uses the `IndexingJob` database table to track the status of each business card's indexing:

- **Status tracking**: pending, in_progress, completed, failed
- **Progress tracking**: Pages indexed vs total pages
- **Error logging**: Last error message for failed jobs
- **Retry tracking**: Number of retry attempts (max 3)

**CLI Commands:**

```bash
# Full indexing (index all resources)
python indexer.py

# Resume interrupted indexing (skip completed)
python indexer.py --mode resume

# Retry failed indexing jobs only
python indexer.py --mode retry

# Re-index a specific business card by ID
python indexer.py --reindex-resource 10042

# Reset all jobs and start fresh
python indexer.py --reset

# Disable tracking (faster, no resume support)
python indexer.py --no-tracking
```

**Modes:**

- **full** (default): Index all business cards, including previously completed ones
- **resume**: Skip already completed business cards, index only pending/failed
- **retry**: Retry only failed jobs that haven't exceeded max retries (3)

**Error Recovery Process:**

1. Indexer creates or updates `IndexingJob` record for each business card
2. Status set to `in_progress` before indexing begins
3. Progress tracked as pages are indexed
4. On success: Status set to `completed`, error cleared
5. On failure: Status set to `failed`, error message logged
6. Retry with `--mode retry` to attempt failed jobs again
7. Jobs are skipped after 3 failed retry attempts

**Example Workflow:**

```bash
# Initial indexing (indexes 100 business cards)
python indexer.py

# Crashes after 60 cards...

# Resume where it left off
python indexer.py --mode resume
# Only indexes the remaining 40 cards

# If some failed, retry them
python indexer.py --mode retry
# Retries only the failed cards (max 3 attempts each)
```

**Database Model:**

The `IndexingJob` table tracks:

```python
resource_id: int          # Business card ID (offset by 10000)

status: str               # pending, in_progress, completed, failed
pages_indexed: int        # Number of pages successfully indexed
total_pages: int          # Total pages discovered for the site
last_error: str           # Error message if failed
started_at: datetime      # When indexing started
completed_at: datetime    # When indexing completed
retry_count: int          # Number of retry attempts (max 3)
```

### Environment Variables

**Frontend:**

- `NEXT_PUBLIC_API_URL` - Backend API URL

**Backend:**

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB` - Database connection
- `UPLOAD_FOLDER` - Directory for uploaded files
- `SECRET_KEY` - Flask session secret

**Indexer:**

- `OPENSEARCH_HOST`, `OPENSEARCH_PORT` - OpenSearch connection
- `NAMESPACE` - Namespace for index isolation
- `BACKEND_URL` - Backend API URL for loading cards
