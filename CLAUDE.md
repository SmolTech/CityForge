# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CityForge is a full-stack community platform with web and mobile interfaces built with Next.js 15 and React Native/Expo. The application features a business directory, resource directory, community submissions, and search functionality. **IMPORTANT: The Flask backend has been replaced by Next.js API routes.** Docker images are built via GitHub Actions and pushed to GitHub Container Registry.

## Architecture

**CRITICAL CHANGE: Flask Backend Replaced by Next.js**

The project is now structured as a three-component application:

- **Full-Stack Next.js App**: Next.js 15 with TypeScript, Tailwind CSS v4, app router, and API routes (replaces separate Flask backend)
- **Mobile App**: React Native with Expo for iOS and Android
- **Indexer**: Python service that indexes business card websites into OpenSearch for full-text search
- **Infrastructure**: Docker containers with automated builds via GitHub Actions

**Migration Status**: Currently migrating existing Flask-based deployments to the new Next.js architecture without database re-initialization.

### Key Components

- **Full-Stack Next.js App** (`src/app/`): Next.js pages and API routes for business directory, resources, admin dashboard, authentication, and search
- **Mobile App** (`mobile/`): React Native/Expo mobile application with native navigation and secure token storage
- **Indexer** (`indexer/`): Python script that crawls business websites and indexes content into OpenSearch
- **Database Models**: PostgreSQL schemas for users, cards, tags, submissions, and resources (managed via Prisma ORM in Next.js)
- **GitHub Actions** (`.github/workflows/`): Automated Docker image builds for all components

**Migration Note**: The Flask backend and its SQLAlchemy models have been replaced by Next.js API routes with Prisma ORM. Database schema and data remain compatible.

## Development Commands

### Full-Stack Next.js Development

```bash
# Development server with Turbopack (includes API routes)
npm run dev

# Production build (includes frontend and API routes)
npm run build

# Start production server (serves both frontend and API)
npm start

# Code quality
npm run lint          # ESLint check
npm run lint:fix      # ESLint with auto-fix
npm run format        # Prettier formatting
npm run format:check  # Prettier check only
npm run typecheck     # TypeScript validation

# Database operations (via Prisma)
npx prisma generate   # Generate Prisma client
npx prisma db push    # Push schema changes to database
npx prisma migrate    # Create and apply migrations
npx prisma studio     # Open Prisma Studio (database GUI)
```

### Mobile App Development

```bash
# From mobile/ directory
npm install

# Start Expo development server
npm start

# Run on iOS Simulator (macOS only)
npm run ios

# Run on Android Emulator
npm run android

# Run on web (for testing)
npm run web

# Environment configuration
cp .env.example .env
# Edit .env with appropriate API URL:
#   iOS Simulator: http://localhost:5000
#   Android Emulator: http://10.0.2.2:5000
#   Physical Device: http://YOUR_COMPUTER_IP:5000
```

### Backend Development

For any locally run python, use python from the venv located in .venv/bin of the root of the project

```bash
# From backend/ directory
pip install -r requirements.txt

# Initialize fresh database
python initialize_db.py

# Create admin user (separate step after initialization)
python create_admin_user.py

# OR for existing databases (run pending migrations only)
export FLASK_APP=app:create_app
flask db upgrade

# OR seed default data only (if database already initialized)
python seed_data.py

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

Database initialization runs automatically via init container before backend pods start:

- Init container runs `python initialize_db.py --non-interactive`
- Handles both fresh databases and migrations for existing databases
- Main container starts only after successful initialization
- See: `k8s/backend-deployment.yaml`

**Manual Database Initialization (Kubernetes):**

For fresh deployments:

```bash
# Initialize fresh database with admin user
kubectl apply -f k8s/init-fresh-db-job.yaml
kubectl logs job/init-fresh-db -n cityforge

# Check job status
kubectl get job init-fresh-db -n cityforge
```

For running migrations on existing databases:

```bash
# Legacy migration job (use init-fresh-db-job.yaml for new deployments)
kubectl apply -f k8s/migration-job.yaml
kubectl logs job/db-migration -n cityforge
```

#### Migration Best Practices

1. **Always review** generated migrations before committing
2. **Test migrations** on a copy of production data
3. **Backup database** before running migrations in production
4. **Never edit** applied migrations - create new ones instead
5. **Commit migrations** to version control with your model changes

#### Database Initialization

The project provides multiple initialization scripts for different use cases:

**For Fresh Databases (Recommended):**

```bash
cd backend
export FLASK_APP=app:create_app

# Initialize fresh database with tables, migrations, and default data
python initialize_db.py

# Create admin user (separate step)
python create_admin_user.py

# The initialize_db.py script will:
# 1. Detect if database is empty
# 2. Create all tables if empty
# 3. Stamp database with current migration version
# 4. Seed default configuration data
# 5. Check for existing admin user and provide guidance
```

**For Existing Databases:**

```bash
cd backend
export FLASK_APP=app:create_app

# Run pending migrations only
flask db upgrade

# Optionally seed default data (safe to run multiple times)
python seed_data.py
```

**For Non-Interactive Environments (Kubernetes, Docker):**

```bash
# Initialize database
python initialize_db.py

# Create admin user (separate command)
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD=SecurePassword123!
python create_admin_user.py --non-interactive
```

**Scripts Overview:**

- `initialize_db.py` - Master initialization script (handles both fresh and existing databases)
- `create_admin_user.py` - Create admin user (separate from database initialization)
- `init_fresh_db.py` - Legacy fresh database initialization (use `initialize_db.py` instead)
- `seed_data.py` - Seed default data only (idempotent, safe to run multiple times)
- `init_db.py` - **DEPRECATED** - Old initialization script (do not use)

**Important:**

- `initialize_db.py` is idempotent and safe to run multiple times
- It detects database state and chooses the correct initialization path
- Admin user creation is now separate - run `create_admin_user.py` after database initialization
- For existing databases with tables but no migrations, see troubleshooting in script output
- All scripts respect Flask-Migrate migration tracking

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

**Forum Models:**

- `ForumCategory`: Forum categories with slugs and display ordering
- `ForumThread`: Discussion threads within categories (with pin/lock status)
- `ForumPost`: Individual posts within threads
- `ForumCategoryRequest`: User requests for new forum categories (pending admin approval)
- `ForumReport`: User reports of inappropriate content (pending admin resolution)

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

### Authentication Security

The application supports **dual authentication modes** for web and mobile clients:

**Web Authentication (httpOnly Cookies):**

- **httpOnly cookies**: JavaScript cannot access authentication tokens, preventing XSS token theft
- **SameSite protection**: Cookies use `SameSite=Lax` to protect against CSRF attacks
- **HTTPS enforcement**: Cookies are marked as `Secure` in production (HTTPS only)
- **CORS credentials**: Backend configured to accept cookies from authorized origins only

**Mobile Authentication (Bearer Tokens):**

- **Secure storage**: Tokens stored using Expo SecureStore (encrypted, hardware-backed)
- **Authorization headers**: Tokens sent via `Authorization: Bearer <token>` header
- **No cookie support**: Mobile apps cannot use httpOnly cookies
- **Token in response**: Login/register endpoints return `access_token` in response body

**Shared Security Features:**

- **Database-backed blacklist**: Logout immediately invalidates tokens via database blacklist
- **Same token format**: Both web and mobile use identical JWT tokens
- **Unified validation**: Backend validates tokens regardless of delivery method

**Backend Configuration** (`backend/app/__init__.py`):

```python
# Support both cookies (web) and headers (mobile)
app.config["JWT_TOKEN_LOCATION"] = ["cookies", "headers"]

# Cookie configuration (for web)
app.config["JWT_COOKIE_HTTPONLY"] = True  # Prevents JavaScript access
app.config["JWT_COOKIE_SECURE"] = is_production  # HTTPS only in production
app.config["JWT_COOKIE_SAMESITE"] = "Lax"  # CSRF protection
app.config["JWT_COOKIE_CSRF_PROTECT"] = False  # Can enable with CSRF tokens

# Header configuration (for mobile)
app.config["JWT_HEADER_NAME"] = "Authorization"
app.config["JWT_HEADER_TYPE"] = "Bearer"
```

**CORS Configuration** (`backend/app/__init__.py`):

```python
CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:3000",  # Development frontend
        os.getenv("FRONTEND_URL", ""),  # Production frontend
    ],
)
```

**Frontend Configuration** (`src/lib/api/client.ts`):

All API requests include `credentials: "include"` to send cookies:

```typescript
const fetchOptions: RequestInit = {
  ...options,
  headers,
  credentials: "include", // Include cookies in requests
};
```

**How It Works:**

1. **Login/Register**: Backend sets httpOnly cookie via `set_access_cookies()`
2. **API Requests**: Frontend automatically sends cookie with every request
3. **Token Validation**: Backend validates JWT from cookie on protected routes
4. **Logout**: Backend clears cookie via `unset_jwt_cookies()` and blacklists token

**Migration from localStorage:**

Previous versions stored tokens in localStorage. The new httpOnly cookie approach:

- ✅ Protects against XSS attacks (JavaScript cannot read cookies)
- ✅ Automatic token transmission (no manual header setting)
- ✅ Better security posture for production deployments
- ✅ Comprehensive CORS configuration with multi-layer security
- ✅ Mobile app support with Authorization headers

### CORS Configuration

The application implements comprehensive Cross-Origin Resource Sharing (CORS) protection with multiple layers of security:

#### Multi-Layer CORS Architecture

**1. nginx Proxy Layer (Primary - Production)**

The nginx reverse proxy (`nginx.conf`) provides the primary CORS handling for production deployments:

```nginx
# Dynamic origin validation with regex patterns
set $cors_origin "";
if ($http_origin ~* ^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$) {
    set $cors_origin $http_origin;
}
if ($http_origin ~* ^https://([a-zA-Z0-9-]+\.)*community\.community$) {
    set $cors_origin $http_origin;
}
```

**2. Next.js Middleware Layer (Fallback - Development)**

The Next.js middleware (`src/middleware.ts` and `src/lib/cors.ts`) provides CORS handling when nginx is not available:

- Automatic preflight request handling
- Dynamic origin validation
- Development-friendly defaults
- Seamless API route integration

#### Configuration Management

**Environment Variables:**

- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed domains
- Supports environment-specific configuration
- Automatic subdomain support for configured domains

**Examples:**

```bash
# Development
CORS_ALLOWED_ORIGINS=localhost:3000,127.0.0.1:3000

# Production
CORS_ALLOWED_ORIGINS=community.community,cityforge.cityforge
```

#### Security Features

**Origin Validation:**

- Exact domain matching with subdomain support
- Localhost/IP development access
- Regex-based pattern matching for security

**Headers Configuration:**

- Methods: `GET, POST, PUT, DELETE, OPTIONS`
- Headers: `Authorization, Content-Type, X-Requested-With`
- Credentials: `true` (supports cookie authentication)
- Max Age: `86400` seconds (24 hours)

**Mobile App Support:**

- CORS headers provided but not required for mobile HTTP clients
- Direct API access with Authorization headers
- No same-origin policy restrictions

#### Testing and Validation

Use the provided test script to verify CORS configuration:

```bash
# Test local development
./scripts/test-cors.sh http://localhost:3000

# Test production
./scripts/test-cors.sh https://your-domain.com
```

#### Deployment Configurations

**Docker Compose** (`docker-compose.yml`):

```yaml
environment:
  CORS_ALLOWED_ORIGINS: "localhost:3000,127.0.0.1:3000,community.community,cityforge.cityforge"
```

**Kubernetes** (`k8s/config.yaml`):

```yaml
data:
  CORS_ALLOWED_ORIGINS: "community.community,www.community.community"
```

**API Route Integration:**

Individual routes can override CORS settings using the `withCORS` wrapper:

```typescript
import { withCORS } from "@/lib/cors";

export const GET = withCORS(
  async (request) => {
    return NextResponse.json({ data: "response" });
  },
  {
    allowedOrigins: ["https://special-client.com"],
  }
);
```

See `docs/CORS_CONFIGURATION.md` for complete documentation and troubleshooting guide.

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

The Next.js application implements comprehensive rate limiting for authentication endpoints to protect against:

- Brute force attacks on authentication endpoints
- Resource exhaustion (DoS)
- Account enumeration
- Spam registration attempts

#### Implementation Architecture

**Next.js Middleware-Based Rate Limiting** (`src/lib/auth/rateLimit.ts`):

- **In-memory sliding window algorithm** with IP-based tracking
- **Configurable limits** per authentication endpoint
- **Standard HTTP headers** (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- **429 status responses** with Retry-After header
- **Automatic cleanup** to prevent memory leaks

#### Rate Limits by Authentication Endpoint

**Core Authentication:**

- **Login** (`/api/auth/login`): 5 requests per minute
- **Registration** (`/api/auth/register`): 3 requests per hour
- **Forgot Password** (`/api/auth/forgot-password`): 5 requests per hour
- **Reset Password** (`/api/auth/reset-password`): 5 requests per hour
- **Resend Verification** (`/api/auth/resend-verification`): 3 requests per hour
- **Verify Email** (`/api/auth/verify-email`): 10 requests per hour

#### Rate Limit Configuration

**Configuration Object** (`src/lib/auth/rateLimit.ts`):

```typescript
export const AUTH_RATE_LIMITS = {
  login: {
    maxRequests: 5,
    windowMs: 60000,
    description: "5 logins per minute",
  },
  register: {
    maxRequests: 3,
    windowMs: 3600000,
    description: "3 registrations per hour",
  },
  "forgot-password": {
    maxRequests: 5,
    windowMs: 3600000,
    description: "5 password resets per hour",
  },
  "reset-password": {
    maxRequests: 5,
    windowMs: 3600000,
    description: "5 password resets per hour",
  },
  "resend-verification": {
    maxRequests: 3,
    windowMs: 3600000,
    description: "3 verification emails per hour",
  },
  "verify-email": {
    maxRequests: 10,
    windowMs: 3600000,
    description: "10 verifications per hour",
  },
};
```

#### API Implementation

**Route Protection** - Apply to any authentication endpoint:

```typescript
// Example: src/app/api/auth/login/route.ts
import { withAuthRateLimit } from "@/lib/auth/rateLimit";

const loginHandler = async (request: NextRequest) => {
  // Your login logic here
  return NextResponse.json({ success: true });
};

export const POST = withAuthRateLimit("login", loginHandler);
```

**Manual Rate Limit Checking:**

```typescript
import {
  checkAuthRateLimit,
  createRateLimitResponse,
} from "@/lib/auth/rateLimit";

export async function POST(request: NextRequest) {
  const rateLimitResult = checkAuthRateLimit(request, "login");

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  // Continue with normal request processing
}
```

#### Rate Limit Response Format

When rate limit is exceeded, the API returns HTTP 429 with:

```json
{
  "error": {
    "message": "Too many login attempts. Please try again in 45 seconds.",
    "type": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 45
  }
}
```

**HTTP Headers:**

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995200
Retry-After: 45
```

#### IP Address Detection

The rate limiting system automatically detects client IPs from:

1. `X-Forwarded-For` header (first IP in chain)
2. `X-Real-IP` header
3. `X-Client-IP` header
4. Fallback to `127.0.0.1` for development

#### Memory Management

**Automatic Cleanup:**

- Rate limit entries expire automatically after window period
- Memory usage scales with number of unique IPs, not total requests
- No background processes required

**Testing Utilities:**

- `clearRateLimitStore()` - Clear all rate limit data for tests
- `getRateLimitStatus()` - Get current rate limit status for debugging

#### Testing

Comprehensive test suite with 24 test cases covering:

- **Core functionality**: Allow/deny within limits, window expiration
- **Multi-endpoint isolation**: Different endpoints tracked independently
- **IP handling**: Multiple IPs, header extraction, forwarded IPs
- **Middleware integration**: Automatic response creation, header preservation
- **Configuration validation**: All endpoints properly configured
- **Memory management**: No leaks, proper cleanup

Run tests: `npm test tests/utils/auth-rate-limit.test.ts`

#### Production Considerations

**For High-Traffic Production Deployments:**

Consider replacing in-memory storage with Redis for multi-instance deployments:

```typescript
// Future enhancement - Redis-backed rate limiting
// Would require implementing Redis adapter for the rate limiting system
```

**Current Implementation Benefits:**

- ✅ Zero external dependencies
- ✅ No Redis/database required
- ✅ Automatic memory cleanup
- ✅ High performance (in-memory)
- ✅ Suitable for most production deployments

### Security Headers

The application implements comprehensive security headers to protect against common web vulnerabilities including XSS, clickjacking, MITM attacks, and data leakage.

#### Multi-Layer Security Implementation

**Dual Layer Approach:**

- **Next.js Middleware** (`src/middleware.ts`) - Primary security headers applied to all responses
- **nginx Configuration** (`nginx.conf`) - Backup security headers for production deployments

This ensures security headers are present even if one layer fails or is misconfigured.

#### Security Headers Implemented

**Content Security Policy (CSP)**:

- Prevents XSS attacks by controlling resource loading sources
- Environment-specific policies (development includes `'unsafe-eval'`, production is strict)
- Always includes `'unsafe-inline'` for styles (required by Tailwind CSS)

**HTTP Strict Transport Security (HSTS)**:

- Forces HTTPS connections to prevent MITM attacks
- 1-year cache duration with subdomain inclusion and preload eligibility

**Additional Headers**:

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy` - Disables unnecessary browser features (camera, microphone, geolocation)

#### Implementation Files

**Security Headers Utility** (`src/lib/security-headers.ts`):

```typescript
import { getSecurityHeaders } from "@/lib/security-headers";

const headers = getSecurityHeaders();
// Apply to response
```

**Next.js Middleware Integration** (`src/middleware.ts`):

```typescript
import { getSecurityHeaders } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
```

**nginx Configuration** (`nginx.conf`):

```nginx
# Security Headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "..." always;
```

#### Environment Configuration

**Development Environment**:

- Includes `'unsafe-eval'` in script-src for hot reload
- Relaxed CSP for development tools
- WebSocket connections allowed for hot reload (`ws:`, `wss:`)

**Production Environment**:

- Strict CSP with minimal allowed sources
- No `'unsafe-eval'` to prevent code injection
- Maximum security configuration

#### Testing and Validation

**Automated Testing** (`tests/utils/security-headers.test.ts`):

- 23 comprehensive tests covering all security headers
- Environment-specific CSP validation
- Error handling and graceful fallbacks

**CLI Testing Tool** (`scripts/test-security-headers.sh`):

```bash
# Test local development
./scripts/test-security-headers.sh http://localhost:3000

# Test production deployment
./scripts/test-security-headers.sh https://yourdomain.com
```

**Programmatic Validator** (`scripts/security-headers-validator.ts`):

```bash
npx tsx scripts/security-headers-validator.ts https://yourdomain.com
```

#### Security Benefits

**Attack Vectors Mitigated**:

- **Cross-Site Scripting (XSS)**: CSP blocks inline scripts and untrusted sources
- **Clickjacking**: X-Frame-Options prevents iframe embedding
- **Man-in-the-Middle (MITM)**: HSTS forces HTTPS connections
- **Information Disclosure**: Referrer-Policy controls referrer leakage

**Compliance**:

- OWASP recommendations compliance
- Industry security best practices
- Modern browser compatibility

For complete documentation, see `docs/SECURITY_HEADERS.md`.

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
- `/admin/forums/*` - Forum administration (categories, requests, reports, threads)

#### Admin Forum API Endpoints

**Category Management:**

- `GET /api/admin/forums/categories` - List all forum categories
- `POST /api/admin/forums/categories` - Create new forum category
- `GET /api/admin/forums/categories/{id}` - Get specific category details
- `PUT /api/admin/forums/categories/{id}` - Update forum category
- `DELETE /api/admin/forums/categories/{id}` - Delete forum category

**Category Request Management:**

- `GET /api/admin/forums/category-requests` - List pending category requests
- `POST /api/admin/forums/category-requests/{id}/approve` - Approve category request
- `POST /api/admin/forums/category-requests/{id}/reject` - Reject category request

**Content Moderation:**

- `GET /api/admin/forums/reports` - List reported content
- `POST /api/admin/forums/reports/{id}/resolve` - Resolve report (dismiss, delete post, delete thread)

**Thread Management:**

- `DELETE /api/admin/forums/threads/{id}` - Delete thread and all posts
- `POST /api/admin/forums/threads/{id}/pin` - Pin/unpin thread
- `POST /api/admin/forums/threads/{id}/lock` - Lock/unlock thread

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
- `/admin/forums` - Admin forum management (admin users only)
- `/forums/*` - Community forums (requires authentication)

**Forum Pages (Authentication Required):**

- `/forums` - Forum categories list
- `/forums/[categorySlug]` - Category threads
- `/forums/[categorySlug]/[threadId]` - Thread details and posts
- `/forums/[categorySlug]/new` - Create new thread
- `/forums/request-category` - Request new forum category

**Authentication Enforcement:**
All forum pages check authentication on mount and redirect unauthenticated users to `/login?redirect=[original-url]`. This allows users to return to their intended destination after logging in.

### Admin Forum Management

The application provides comprehensive forum administration tools for managing community discussions:

#### Category Management

**Features:**

- Create, read, update, delete forum categories
- Automatic slug generation from category names with conflict detection
- Display order management for organizing category hierarchy
- Category activation/deactivation without deletion
- Input validation for names and descriptions

**Workflow:**

1. Admin creates category with name and description
2. System generates URL-safe slug automatically
3. Category appears in forum listings with specified display order
4. Admin can later edit, reorder, or deactivate categories

#### Community Category Requests

**User Flow:**

1. Users can request new forum categories via `/forums/request-category`
2. Requests include category name, description, and justification
3. Requests appear in admin panel for review

**Admin Workflow:**

1. Admin reviews pending requests at `/admin/forums`
2. Admin can approve or reject requests with notes
3. **Approved requests**: Automatically create new forum categories
4. **Rejected requests**: User receives feedback via admin notes
5. Complete audit trail maintains request history

#### Content Moderation System

**Report Processing:**

- Users can report inappropriate forum content (posts, threads)
- Reports include content details, reporter info, and reason
- Reports queue in admin panel for review

**Resolution Actions:**

- **Dismiss Report**: Mark as reviewed, no action taken
- **Delete Post**: Remove specific reported post
- **Delete Thread**: Remove entire thread and all posts

**Audit Trail:**

- All resolutions logged with admin reviewer and timestamp
- Complete history of moderation actions
- Reports maintain status tracking (pending/resolved)

#### Thread Management Tools

**Administrative Controls:**

- **Delete Threads**: Cascade deletion removes thread and all associated posts
- **Pin/Unpin**: Featured threads appear at top of category listings
- **Lock/Unlock**: Prevent new posts while preserving content

**Safety Features:**

- Confirmation required for destructive actions
- Cascade deletions properly handle related data (posts, reports)
- Status changes immediately reflected in forum interface

#### API Implementation Highlights

**Next.js 15 Compatibility:**

- All admin forum APIs properly handle Next.js 15 async route parameters
- Robust error handling with consistent JSON error responses
- JWT authentication integration with role-based access control

**Database Integration:**

- Proper foreign key relationships ensure data integrity
- Cascade deletion handling prevents orphaned records
- Transaction support for complex operations

**Security Features:**

- Admin role verification on all endpoints
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- Rate limiting on admin endpoints

The admin forum system provides professional-grade community management tools suitable for both small communities and larger forum deployments.

### Mobile App Structure

The mobile app (`mobile/`) is built with React Native and Expo:

**Project Structure:**

```
mobile/
├── src/
│   ├── api/          # API client with token-based auth
│   ├── components/   # Reusable UI components
│   ├── contexts/     # React contexts (AuthContext)
│   ├── navigation/   # React Navigation setup
│   ├── screens/      # Screen components
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utilities (tokenStorage, etc.)
├── assets/           # Images, fonts, icons
├── App.tsx           # Root component
└── app.json          # Expo configuration
```

**Main Screens:**

- **Authentication Flow:**
  - `LoginScreen` - User login with email/password
  - `RegisterScreen` - New user registration

- **Main Tabs (Bottom Navigation):**
  - `BusinessScreen` - Business directory with infinite scroll
  - `ResourcesScreen` - Resource directory with categories
  - `SearchScreen` - Full-text search interface
  - `ProfileScreen` - User profile and settings

**Key Features:**

- **React Navigation**: Bottom tabs + stack navigation for auth flow
- **Secure Token Storage**: Expo SecureStore for encrypted token storage
- **Auto-reconnect**: Auth state persists across app restarts
- **Pull-to-refresh**: All list screens support pull-to-refresh
- **Infinite scroll**: Business directory loads more items on scroll
- **Error handling**: User-friendly error messages with retry options

**Authentication Flow:**

1. App checks for stored token on mount
2. If token exists, validates with backend (`/api/auth/me`)
3. If valid, user is authenticated and sees main tabs
4. If invalid/missing, user sees login/register screens
5. After login, token is stored in SecureStore and user sees main tabs

**API Client** (`mobile/src/api/client.ts`):

- Shares same API structure as web client
- Uses Authorization headers instead of cookies
- Automatically includes token from SecureStore
- Handles 401 responses by clearing token and redirecting to login

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

The project provides `.env.example` files for each component to document required configuration:

- **Frontend**: `.env.example` - Copy to `.env.local` for development
- **Backend**: `backend/.env.example` - Copy to `backend/.env` for development
- **Indexer**: `indexer/.env.example` - Copy to `indexer/.env` for development

See the respective `.env.example` files for detailed documentation of all available environment variables and recommended values.

**Frontend Environment Variables:**

- `NEXT_PUBLIC_API_URL` - Backend API URL (required)
- `NEXT_PUBLIC_SITE_URL` - Site URL for server-side fetches (optional)
- `NEXT_PUBLIC_ITEMS_PER_PAGE` - Items per page for pagination (optional, default: 20)

**Backend Environment Variables:**

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB` - Database connection (required)
- `DATABASE_URL` - Alternative to individual database params (optional)
- `JWT_SECRET_KEY` - Secret key for JWT token generation (required)
- `SECRET_KEY` - Flask session secret (required)
- `UPLOAD_FOLDER` - Directory for uploaded files (optional, default: uploads)
- `FLASK_ENV` - Environment mode: development or production (optional, default: development)
- `OPENSEARCH_HOST`, `OPENSEARCH_PORT` - OpenSearch connection (optional, for search)

**Indexer Environment Variables:**

- `OPENSEARCH_HOST`, `OPENSEARCH_PORT` - OpenSearch connection (required)
- `NAMESPACE` - Namespace for index isolation (required, default: default)
- `BACKEND_URL` - Backend API URL for loading cards (required)

### Logging Strategy

The application implements structured logging with environment-based configuration:

#### Backend Logging (Python/Flask)

**Configuration** (`backend/app/utils/logging_config.py`):

The backend uses structured JSON logging with rotating file handlers:

**Features:**

- **JSON formatting** for production/staging (structured, parseable logs)
- **Human-readable formatting** for development (easier to read in terminal)
- **Rotating file handler**: 10MB log files, keep 10 backups
- **Environment-based log levels**:
  - Development: DEBUG
  - Staging: INFO
  - Production: WARNING

**Log Files:**

- Location: `backend/logs/cityforge.log`
- Format: JSON (always, for easy parsing)
- Rotation: 10MB files, 10 backups = ~100MB total

**Environment Variables:**

- `FLASK_ENV`: Sets environment (development/staging/production)
- `LOG_LEVEL`: Override default log level (DEBUG/INFO/WARNING/ERROR)
- `LOG_DIR`: Override log directory (default: logs)

**Example Log Entry (JSON):**

```json
{
  "timestamp": "2025-10-19T01:23:45.123456+00:00",
  "level": "ERROR",
  "message": "Failed to load dashboard data",
  "module": "dashboard",
  "function": "loadData",
  "line": 42,
  "exception": "...stack trace..."
}
```

**Usage in Backend Code:**

```python
import logging

logger = logging.getLogger(__name__)

# Logging examples
logger.debug("Detailed debugging information")
logger.info("General informational message")
logger.warning("Warning message")
logger.error("Error occurred", exc_info=True)  # Includes stack trace
```

#### Frontend Logging (TypeScript/Next.js)

**Configuration** (`src/lib/logger.ts`):

The frontend logger prevents console output in production while maintaining error visibility:

**Features:**

- **Development**: All logs (info, warn, debug) output to console
- **Production**: Only errors are logged (prevents information disclosure)
- **Centralized**: Single logger utility for consistency

**Usage in Frontend Code:**

```typescript
import { logger } from "@/lib/logger";

// Informational logs (development only)
logger.info("User logged in successfully");
logger.debug("API response:", data);

// Warnings (development only)
logger.warn("Deprecated API endpoint used");

// Errors (all environments)
logger.error("Failed to fetch data:", error);
```

**Why Different Approaches:**

- **Backend**: Server logs are centralized and parseable (JSON for log aggregation tools)
- **Frontend**: Browser console logs are visible to users (suppressed in production for security)

#### Log Levels by Environment

| Environment | Backend Level | Frontend Behavior |
| ----------- | ------------- | ----------------- |
| Development | DEBUG         | All logs shown    |
| Staging     | INFO          | All logs shown    |
| Production  | WARNING       | Errors only       |

#### Centralized Logging (Future Enhancement)

For production deployments at scale, consider:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki** (lightweight alternative to ELK)
- **CloudWatch Logs** (if deployed on AWS)
- **Google Cloud Logging** (if deployed on GCP)

JSON-formatted backend logs are already compatible with these tools.
