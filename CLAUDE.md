# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CityForge is a community platform built with Next.js 15 that provides business directory, forums, help wanted posts, support tickets, and resource management. Version 0.9.0 merged the Flask backend into Next.js API routes, consolidating to a single-container architecture.

## Core Commands

### Development

```bash
npm run dev              # Start Next.js dev server with Turbopack
npm run build            # Production build with Turbopack
npm start                # Run production server
```

### Testing

```bash
npm test                 # Run Vitest in watch mode
npm run test:run         # Run all tests once
npm run test:unit        # Unit tests only (excludes integration tests)
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run Playwright E2E tests (requires dev server)
npm run test:e2e:ui      # E2E tests in UI mode
npm run test:e2e:debug   # E2E tests in debug mode
```

### Code Quality

```bash
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format with Prettier
npm run format:check     # Check Prettier formatting
npm run typecheck        # TypeScript type checking
npm run semgrep          # Security analysis

```

### Database

```bash
npx prisma generate      # Generate Prisma client after schema changes
npx prisma db push       # Push schema changes to database (development)
npx prisma migrate dev   # Create and apply migrations (development)
npx prisma studio        # Open Prisma Studio UI

node scripts/db-init.mjs # Initialize database with schema and admin user
```

### Docker Development

```bash
docker-compose up --build              # Build and start all services
docker-compose up -d                   # Start in background
docker exec -it cityforge-frontend sh  # Shell into frontend container
docker exec cityforge-postgres psql -U postgres -d community_db  # Database access

```

## Architecture

### Single-Container Next.js Architecture (0.9.0+)

The project consolidated from a Flask + Next.js architecture to Next.js-only:

- **Frontend**: Next.js 15 App Router (`src/app/`)
- **Backend**: Next.js API Routes (`src/app/api/`)
- **Database**: PostgreSQL with Prisma ORM
- **Search**: OpenSearch for full-text search
- **Indexer**: Python service for website crawling/indexing

### Authentication System

- **JWT tokens** stored in httpOnly cookies (web) and returned in response body (mobile)
- **CSRF protection** for cookie-based auth (web clients only)
- Token blacklisting via `TokenBlacklist` model
- Auth middleware in `src/lib/auth/middleware.ts`
- Password reset flow with email verification

### Database Models (Prisma)

Key models in `prisma/schema.prisma`:

- **User**: Authentication, roles (user/admin/support), email verification

- **Card**: Business directory entries with tags, reviews, approval workflow

- **CardSubmission/CardModification**: User-submitted changes requiring admin review
- **ForumCategory/ForumThread/ForumPost**: Discussion forums
- **HelpWantedPost/HelpWantedComment**: Job/service requests
- **SupportTicket/SupportTicketMessage**: Support system
- **ResourceItem/ResourceCategory**: Community resources
- **Review**: Business ratings and reviews with reporting
- **IndexingJob**: Website crawling status

### API Route Structure

All API routes in `src/app/api/`:

- `auth/` - Registration, login, logout, password reset, email verification
- `admin/` - Admin panel endpoints (users, submissions, reports, analytics)

- `cards/` - Business card CRUD

- `forums/` - Forum categories, threads, posts
- `help-wanted/` - Help wanted posts and comments
- `resources/` - Resource items and categories
- `reviews/` - Business reviews
- `search/` - OpenSearch integration
- `support-tickets/` - Support ticket system
- `submissions/` - Card submission workflow

- `tags/` - Tag management
- `upload/` - Image uploads (Cloudinary or local)

### Error Handling

Centralized error handling in `src/lib/errors/`:

- Use `handleApiError()` or `withErrorHandler()` wrapper for all API routes
- Typed error classes: `NotFoundError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`

- Automatic Prisma error conversion (P2002 → 409, P2025 → 404, P2003 → 400)
- Production-safe: sensitive data hidden, no stack traces
- Consistent JSON format: `{ error: { message, code, details? } }`

### Security

- **CSRF tokens** for cookie-based authentication
- **Rate limiting** via middleware (disabled for E2E tests via `PLAYWRIGHT_E2E_TESTING`)
- **Input sanitization** with DOMPurify
- **Semgrep** static analysis in git hooks and CI
- **Security headers** configured via `src/lib/security-headers.ts`
- **Logger utility** with sensitive data redaction (`src/lib/logger.ts`)
- Follow `SECURITY_GUIDELINES.md` for error handling and debug endpoints

### Git Hooks

Pre-commit: Format, lint-staged, semgrep
Pre-push: Typecheck, lint, semgrep, audit, unit tests, build

## Common Development Patterns

### Creating New API Routes

```typescript
import { withErrorHandler, NotFoundError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth/middleware";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);
  // Your logic here

  return NextResponse.json({ data: result });
}, "GET /api/your-route");
```

### Database Queries with Prisma

Always use Prisma client from `src/lib/db`:

```typescript
import { prisma } from "@/lib/db";

const cards = await prisma.card.findMany({
  where: { approved: true },

  include: { card_tags: { include: { tags: true } } },
  orderBy: { createdDate: "desc" },
});
```

### Testing Integration Tests

Integration tests use testcontainers for PostgreSQL:

```typescript
// Tests automatically start a Docker container
// Use setupTestDatabase() from tests/helpers/database-helpers.ts
```

### Environment Variables

- **Build-time** (client): `NEXT_PUBLIC_*` variables
- **Runtime** (server): All other variables
- See `.env.example` for complete list

- Critical: `DATABASE_URL`, `JWT_SECRET_KEY`, `OPENSEARCH_HOST`

### Deployment

- **Docker Compose**: Single command deployment with nginx reverse proxy
- **Kubernetes**: Manifests in `k8s/`, includes migrations, backups, indexer cronjobs
- Database initialization: Automatic via `scripts/db-init.mjs` in Docker entrypoint

## Project-Specific Notes

### Migration from 0.8.x to 0.9.0

Backend Flask functionality merged into Next.js. Use `scripts/convert-export-to-0.9.0.mjs` for data migration.

### Indexer Service

Python service (`indexer/indexer.py`) that crawls resource websites and indexes content to OpenSearch. Runs as cronjob in Kubernetes.

### Mobile App

React Native/Expo app in `mobile/` - uses same API via Bearer token authentication (no cookies).

### Namespace Support

OpenSearch uses namespaces (set via `NAMESPACE` env var) for multi-tenant deployments.

### Sequence ID Fixes

After manual database operations, run `node scripts/fix-sequences.mjs` to reset PostgreSQL sequences.
