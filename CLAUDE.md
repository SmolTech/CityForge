# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CityForge is a full-stack community website platform built with Next.js 15 and a Python Flask backend. The application features a business directory, resource directory, community submissions, and search functionality. Docker images are built via GitHub Actions and pushed to GitHub Container Registry.

## Architecture

The project is structured as a multi-component application:

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS v4, and app router
- **Backend**: Python Flask API with SQLAlchemy ORM and PostgreSQL database
- **Indexer**: Python service that indexes business card websites into OpenSearch for full-text search
- **Mautic**: Marketing automation platform for email campaigns, contact management, and lead nurturing
- **Infrastructure**: Docker containers with automated builds via GitHub Actions

### Key Components

- **Frontend App** (`src/app/`): Next.js pages for business directory, resources, admin dashboard, authentication, and search
- **Backend API** (`backend/`): Flask application providing REST APIs for cards, resources, auth, admin, and search
- **Indexer** (`indexer/`): Python script that crawls business websites and indexes content into OpenSearch
- **Mautic** (`k8s/mautic-*.yaml`): Marketing automation platform with MySQL database, background cron jobs, and API integration
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
python app.py  # Runs on port 5000

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

### Database Initialization

The `init_db.py` script creates database tables and prompts for admin credentials:

```bash
cd backend
python init_db.py
# Prompts for admin email and password
```

**Important**: Never use default credentials. The script requires interactive input for security.

### Database Schema

The Flask backend defines the following main models:

**Core Models:**

- `User`: User authentication and authorization (admin/user roles)
- `Card`: Business cards in the directory (name, description, contact info, tags, images)
- `Tag`: Tags for categorizing cards
- `CardSubmission`: User-submitted cards pending admin approval
- `CardModification`: User-suggested edits to existing cards

**Resource Models:**

- `ResourceCategory`: Categories for the resource directory
- `ResourceItem`: Items in the resource directory
- `QuickAccessItem`: Featured quick-access items
- `ResourceConfig`: Site-wide configuration values

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

### Styling

- Tailwind CSS v4 with custom configuration
- Geist fonts (sans and mono variants)
- Responsive design with dark mode support

### Search Functionality

The indexer component (`indexer/indexer.py`) provides full-text search:

- Crawls business card websites (respects robots.txt)
- Discovers and parses sitemaps
- Indexes content into OpenSearch
- Supports multi-page indexing per business
- Runs as a scheduled job or on-demand

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

### Marketing Automation (Mautic)

Mautic provides email marketing and contact management capabilities for CityForge. See `k8s/MAUTIC_SETUP.md` for detailed setup instructions.

**Key Features:**

- Email campaigns and newsletters
- Contact segmentation and lead scoring
- Campaign workflows with conditional logic
- Landing pages and forms
- Multi-channel campaigns (email, SMS, push notifications)
- Analytics and reporting

**Deployment:**

```bash
# Install Percona MySQL Operator
kubectl apply -f https://raw.githubusercontent.com/percona/percona-xtradb-cluster-operator/v1.14.0/deploy/bundle.yaml

# Deploy MySQL cluster
kubectl apply -f k8s/mautic-mysql.yaml

# Deploy Mautic application and cron jobs
kubectl apply -f k8s/mautic-deployment.yaml
kubectl apply -f k8s/mautic-service.yaml
```

**Local Development:**

```bash
# Start Mautic with docker-compose
docker-compose up mysql mautic

# Access at http://localhost:8080
```

**Integration:**

- REST API for contact management
- JavaScript tracking code for website visitors
- Webhooks for event notifications
- See `k8s/MAUTIC_SETUP.md` for API examples
