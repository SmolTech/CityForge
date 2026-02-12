# Database Initialization & Seeding

## Overview

CityForge uses a two-tier data initialization approach:

1. **`db-init.mjs`** — Runs automatically on every container start. Creates all structural data needed for a fully functional system (site config, forum categories, resource categories, admin user). Idempotent and safe to run repeatedly.

2. **`seed-database.mjs`** — Optional. Seeds demo/sample data (business cards, tags) for development or demonstrations. Not needed for production.

## Fresh Install

On a fresh install, the system is fully usable after `db-init.mjs` runs. No manual seeding is required. The following is created automatically:

- **Admin user** (from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars)
- **Site configuration** (22 config keys with sensible defaults, customizable via admin panel)
- **Forum categories** (General Discussion, Local Events, Business Directory, Community News, Help & Support)
- **Resource categories** (Government Services, Healthcare, Education, etc.)

Resources, business cards, tags, and all other content are created by users through the web interface.

## Environment Variables

### Required (from PostgreSQL operator secret)

- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password

### Required (from config map)

- `POSTGRES_HOST` - Database hostname (e.g., "cityforge-db")
- `POSTGRES_DB` - Database name (e.g., "cityforge")

### Optional

- `POSTGRES_PORT` - Database port (defaults to "5432")
- `DATABASE_URL` - If set, overrides the constructed URL
- `ADMIN_EMAIL` - Email for admin user
- `ADMIN_PASSWORD` - Password for admin user
- `SEED_SAMPLE_DATA` - Set to "false" to skip sample data in seed-database.mjs

## Usage

### Automatic (Docker/Kubernetes)

`db-init.mjs` runs automatically via `docker-entrypoint.sh` on every container start.

### Manual initialization

```bash
# Set environment variables, then:
node scripts/db-init.mjs
```

### Optional demo data

```bash
# Seed sample business cards and tags for development
npm run seed-database

# Or skip sample data
SEED_SAMPLE_DATA=false npm run seed-database
```

### In Kubernetes

The seed job (`k8s/seed-job.yaml`) is optional and only seeds demo data. Structural data is handled by `db-init.mjs` which runs in the container entrypoint.

```bash
kubectl apply -f k8s/seed-job.yaml  # Optional: demo data only
```

## What each script creates

### db-init.mjs (automatic, structural)

| Data | Purpose |
|------|---------|
| Admin user | First admin account for the system |
| Site config (22 keys) | Site title, description, colors, copyright, etc. |
| Forum categories (5) | General Discussion, Local Events, Business Directory, Community News, Help & Support |
| Resource categories (8) | Government, Healthcare, Education, Emergency, Utilities, Transportation, Recreation, Community |

### seed-database.mjs (optional, demo)

| Data | Purpose |
|------|---------|
| Sample tags (6) | Restaurant, Coffee Shop, Local Business, etc. |
| Sample business cards (4) | Mario's Pizza, Coffee Corner, etc. |

## Idempotent

Both scripts are safe to run multiple times. They use `upsert` or existence checks to avoid creating duplicates, and never overwrite admin customizations to site configuration.
