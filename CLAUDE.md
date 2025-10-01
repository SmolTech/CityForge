# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CityForge is a full-stack community website platform built with Next.js 15 and a Python Flask backend. The application features news, calendar events, business directory, and op-ed sections for local communities. The project uses Docker containers deployed to Kubernetes with a local registry system.

## Architecture

The project is structured as a dual-component application:

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS v4, and app router
- **Backend**: Python Flask API with SQLAlchemy ORM and PostgreSQL database
- **Infrastructure**: Docker containers deployed to Kubernetes with automated image management

### Key Components

- **Frontend App** (`src/app/`): Next.js pages for news, calendar, business directory, and op-ed sections
- **Backend API** (`backend/`): Flask application providing REST APIs for all content types
- **Database Models**: PostgreSQL schemas for articles, events, businesses, and op-eds
- **Kubernetes Manifests** (`k8s/`): Complete deployment configuration including PostgreSQL

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
python app.py  # Development server on port 5000

# Production deployment uses gunicorn
gunicorn --bind 0.0.0.0:5000 --workers 4 app:app
```

### Container & Deployment Commands

```bash
# Build and deploy everything
make all

# Individual operations
make build                    # Build both frontend and backend images
make build-frontend          # Build frontend Docker image only
make build-backend           # Build backend Docker image only
make push                    # Push both images to registry
make update-k8s              # Update Kubernetes manifests with new image SHAs
make deploy                  # Deploy to Kubernetes cluster
make clean                   # Remove Docker images

# Kubernetes operations
kubectl apply -f k8s/namespace.yaml
kubectl apply -k k8s/ -n community
```

## Code Quality & Git Hooks

The project enforces code quality through automated git hooks:

- **Pre-commit**: Runs `lint-staged` (ESLint + Prettier on staged files)
- **Pre-push**: Runs `npm run typecheck`, `npm run lint`, and `npm run build`

## Key Development Notes

### Container Registry
- Uses local registry at `192.168.0.63:32000`
- Images are built with `--network=host` for build-time network access
- Kubernetes deployments use immutable SHA256 image references that are automatically updated

### Database Schema
The Flask backend defines four main models:
- `NewsArticle`: Community news with author and featured status
- `CalendarEvent`: Community events with date/time and location
- `Business`: Local business directory with categories
- `OpEd`: Opinion editorials with approval workflow

### API Endpoints
All backend APIs are prefixed with `/api/`:
- `/api/news` - News articles (supports featured filtering)
- `/api/events` - Calendar events (supports upcoming filtering)
- `/api/businesses` - Business directory (supports category filtering)
- `/api/op-eds` - Opinion editorials (supports approval filtering)

### Frontend Structure
Uses Next.js 15 app router with dedicated pages:
- `/news` - News articles page
- `/calendar` - Community calendar
- `/business` - Business directory
- `/op-ed` - Opinion & editorial section

### Styling
- Tailwind CSS v4 with custom configuration
- Geist fonts (sans and mono variants)
- Responsive design with dark mode support