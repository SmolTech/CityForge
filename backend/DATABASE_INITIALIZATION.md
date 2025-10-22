# Database Initialization Guide

This guide explains how to initialize the CityForge database from scratch.

## Quick Start

### For Fresh Databases (Local Development)

```bash
cd backend
export FLASK_APP=app:create_app
python initialize_db.py
```

The script will:

1. Detect that the database is empty
2. Create all tables using SQLAlchemy models
3. Stamp the database with the current migration version
4. Seed default configuration data
5. Prompt you to create an admin user

### For Existing Databases

```bash
cd backend
export FLASK_APP=app:create_app
flask db upgrade
```

This runs any pending migrations without affecting existing data.

### For Kubernetes/Docker Deployments

The database is automatically initialized when backend pods start via an init container:

```yaml
initContainers:
  - name: db-migration
    command: ["python", "initialize_db.py", "--non-interactive"]
    env:
      - name: ADMIN_EMAIL
        value: "admin@example.com"
      - name: ADMIN_PASSWORD
        valueFrom:
          secretKeyRef:
            name: admin-secret
            key: password
```

## Scripts Overview

### `initialize_db.py` (Recommended)

**Purpose**: Master initialization script that handles both fresh and existing databases.

**Usage**:

```bash
# Interactive mode (prompts for admin user)
python initialize_db.py

# Non-interactive mode (uses environment variables)
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD=SecurePassword123!
python initialize_db.py --non-interactive
```

**What it does**:

- Detects if database is empty or has existing tables
- For empty databases: Creates tables, stamps migrations, seeds data
- For existing databases: Runs pending migrations
- Handles edge cases (e.g., tables exist but no migration tracking)
- Idempotent - safe to run multiple times

### `init_fresh_db.py`

**Purpose**: Initialize a completely fresh database (will fail if database is not empty).

**Usage**:

```bash
python init_fresh_db.py
# OR
python init_fresh_db.py --non-interactive
```

**Use when**:

- You're absolutely certain the database is empty
- You want a script that enforces fresh initialization

### `seed_data.py`

**Purpose**: Seed default configuration data only.

**Usage**:

```bash
python seed_data.py
```

**Use when**:

- Database tables already exist
- You just want to add/update default configuration
- Idempotent - won't create duplicates

### `init_db.py` (DEPRECATED)

**DO NOT USE** - This script is deprecated and may cause conflicts with migrations.

Use `initialize_db.py` instead.

## Troubleshooting

### "Database has tables but no migration tracking"

This occurs when tables were created with `db.create_all()` instead of migrations.

**Solution**:

```bash
# Option A: Add migration tracking to existing database
export FLASK_APP=app:create_app
flask db stamp head
flask db upgrade

# Option B: Start fresh (⚠️ DESTROYS DATA)
# Drop database and run initialize_db.py
```

### "Token blacklist table already exists"

This was a common issue with the old `init_db.py` script.

**Solution**: Use `initialize_db.py` which handles this properly.

### Migration conflicts after using init_db.py

If you previously used `init_db.py`, your database may have tables but incorrect migration tracking.

**Solution**:

```bash
export FLASK_APP=app:create_app

# Check current migration version
flask db current

# If no version shown:
flask db stamp head

# Run any pending migrations
flask db upgrade
```

## Kubernetes Deployment

### Fresh Deployment

1. Deploy database (PostgreSQL):

   ```bash
   kubectl apply -f k8s/postgres.yaml
   ```

2. Initialize database:

   ```bash
   kubectl apply -f k8s/init-fresh-db-job.yaml
   kubectl logs job/init-fresh-db -n cityforge -f
   ```

3. Deploy backend:
   ```bash
   kubectl apply -f k8s/backend-deployment.yaml
   ```

### Automatic Initialization

The backend deployment has an init container that automatically runs `initialize_db.py`:

- For fresh databases: Creates tables and seeds data
- For existing databases: Runs pending migrations
- No manual intervention needed

### Setting Admin User in Kubernetes

Create a secret with admin credentials:

```bash
kubectl create secret generic cityforge-admin-secret \
  --from-literal=email=admin@example.com \
  --from-literal=password=SecurePassword123! \
  -n cityforge
```

Update `k8s/backend-deployment.yaml` or `k8s/init-fresh-db-job.yaml`:

```yaml
env:
  - name: ADMIN_EMAIL
    valueFrom:
      secretKeyRef:
        name: cityforge-admin-secret
        key: email
  - name: ADMIN_PASSWORD
    valueFrom:
      secretKeyRef:
        name: cityforge-admin-secret
        key: password
```

## Environment Variables

### Required

- `POSTGRES_HOST` - Database hostname
- `POSTGRES_PORT` - Database port (usually 5432)
- `POSTGRES_DB` - Database name
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `FLASK_APP` - Flask application (set to `app:create_app`)

### Optional (for admin user creation)

- `ADMIN_EMAIL` - Admin user email
- `ADMIN_PASSWORD` - Admin user password (must meet validation requirements)

If not provided, admin user creation will be skipped in non-interactive mode or prompted in interactive mode.

## Best Practices

1. **Always backup** before running database initialization in production
2. **Test migrations** on a copy of production data before deploying
3. **Use initialize_db.py** for all new deployments
4. **Review migration files** before committing to version control
5. **Never edit** applied migrations - create new ones instead

## Migration Workflow

After making changes to database models:

```bash
cd backend
export FLASK_APP=app:create_app

# Generate migration
flask db migrate -m "Description of changes"

# Review the generated migration in migrations/versions/

# Apply migration
flask db upgrade

# Commit migration to version control
git add migrations/versions/*.py
git commit -m "Add migration for [changes]"
```
