# Database Migration Guide

CityForge uses [Alembic](https://alembic.sqlalchemy.org/) for database schema migrations. This provides version control for your database schema with automatic upgrade/downgrade capabilities.

## Table of Contents

- [Quick Start](#quick-start)
- [Common Tasks](#common-tasks)
- [Deployment](#deployment)
- [Migration Workflow](#migration-workflow)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Start

### First Time Setup (New Database)

```bash
cd backend

# 1. Install dependencies (includes Alembic)
pip install -r requirements.txt

# 2. Run migrations to create all tables
alembic upgrade head

# 3. Initialize default data and create admin user
python init_db.py
```

### Upgrading Existing Database

```bash
cd backend

# Check current version
alembic current

# Upgrade to latest
alembic upgrade head
```

## Common Tasks

### Check Migration Status

```bash
# Show current database version
python migrations.py status
# or
alembic current --verbose

# Show migration history
python migrations.py history
# or
alembic history --verbose
```

### Upgrade Database

```bash
# Upgrade to latest version
python migrations.py upgrade
# or
alembic upgrade head

# Upgrade by 1 version
alembic upgrade +1

# Upgrade to specific revision
alembic upgrade abc123
```

### Rollback (Downgrade)

```bash
# Downgrade by 1 version
python migrations.py downgrade
# or
alembic downgrade -1

# Downgrade by 2 versions
alembic downgrade -2

# Downgrade to specific revision
alembic downgrade abc123

# Downgrade to base (WARNING: drops all tables!)
alembic downgrade base
```

### Create New Migration

After modifying SQLAlchemy models in `app/models/`:

```bash
# Auto-generate migration from model changes
python migrations.py create "add user preferences table"
# or
alembic revision --autogenerate -m "add user preferences table"

# IMPORTANT: Review the generated file in alembic/versions/ before committing!
```

### Manual Migration

If you need to write a migration manually (for data migrations, etc.):

```bash
# Create empty migration file
alembic revision -m "migrate user data"

# Edit the file in alembic/versions/ and write upgrade/downgrade functions
```

## Deployment

### Kubernetes

Migrations run automatically via init container in `k8s/backend-deployment.yaml`:

```yaml
initContainers:
  - name: migrate
    image: ghcr.io/smoltech/cityforge-backend
    command: ["alembic", "upgrade", "head"]
```

The backend pods will not start until migrations complete successfully.

### Docker Compose

Migrations run automatically via separate service in `docker-compose.yml`:

```yaml
migrate:
  build: ./backend
  command: ["alembic", "upgrade", "head"]
  depends_on:
    postgres:
      condition: service_healthy
```

The backend service depends on the migrate service completing successfully.

### Manual Deployment

For manual deployments or production environments without orchestration:

```bash
# SSH into server
cd /path/to/cityforge/backend

# Activate virtual environment
source venv/bin/activate

# Run migrations
alembic upgrade head

# Restart backend service
systemctl restart cityforge-backend
```

## Migration Workflow

### Development Workflow

1. **Make Model Changes**

   ```python
   # backend/app/models/user.py
   class User(db.Model):
       # Add new column
       phone_number = db.Column(db.String(20), nullable=True)
   ```

2. **Generate Migration**

   ```bash
   cd backend
   python migrations.py create "add phone number to users"
   ```

3. **Review Generated Migration**

   ```bash
   # Check the file in alembic/versions/
   # Make sure it looks correct!

   ```

4. **Test Migration**

   ```bash
   # Apply migration
   alembic upgrade head

   # Test your application
   python app.py

   # If something is wrong, rollback
   alembic downgrade -1
   ```

5. **Commit to Git**
   ```bash
   git add alembic/versions/xxx_add_phone_number_to_users.py
   git add app/models/user.py
   git commit -m "Add phone number field to User model"
   ```

### Team Workflow

When multiple developers create migrations:

1. **Pull Latest Changes**
   ```bash
   git pull origin main
   ```
2. **Check for New Migrations**

   ```bash
   alembic history
   alembic current
   ```

3. **Apply Pending Migrations**

   ```bash
   alembic upgrade head
   ```

4. **Create Your Migration**

   ```bash
   alembic revision --autogenerate -m "your changes"
   ```

5. **Handle Conflicts**

   If you get "multiple heads" error:

   ```bash

   # Merge migration branches
   alembic merge -m "merge migrations" head1 head2
   ```

## Troubleshooting

### "Target database is not up to date"

This means pending migrations exist. Run:

```bash
alembic upgrade head

```

### "Can't locate revision identified by 'xxx'"

The migration file is missing. Common causes:

- Didn't pull latest code from Git
- Migration file wasn't committed
- Working in wrong directory

Solution:

```bash
git pull
cd backend
alembic upgrade head
```

### "Multiple heads"

Multiple migration branches exist. Merge them:

```bash
alembic heads  # Show all heads
alembic merge -m "merge branches" head1 head2
alembic upgrade head
```

### Database Out of Sync with Models

If you modified models without creating a migration:

```bash
# Create migration to sync
alembic revision --autogenerate -m "sync database with models"
alembic upgrade head
```

### Starting Fresh (Development Only)

**WARNING: This destroys all data!**

```bash
# Drop all tables
alembic downgrade base


# Or drop database and recreate
dropdb community_db
createdb community_db

# Apply all migrations
alembic upgrade head

# Reinitialize data
python init_db.py
```

### Marking Database as Up-to-Date Without Running Migrations

If you manually modified the database or need to mark it as current:

```bash
# Mark as latest version without running migrations
alembic stamp head

# Mark as specific version
alembic stamp abc123
```

**Use with caution!** This doesn't actually modify the schema.

## Best Practices

### DO

✅ **Always review auto-generated migrations** - They might not be perfect
✅ **Test migrations in development first** - Before applying to production
✅ **Write downgrade functions** - Allow rollbacks if needed
✅ **Use descriptive migration messages** - "add user preferences" not "update db"
✅ **Keep migrations small and focused** - One logical change per migration

✅ **Commit migrations with code changes** - Keep them in sync
✅ **Add comments to complex migrations** - Explain what and why

### DON'T

❌ **Don't edit applied migrations** - Create a new one instead
❌ **Don't use `db.create_all()`** - Use migrations exclusively for schema changes
❌ **Don't skip reviewing autogenerated code** - It can miss things
❌ **Don't forget to add migration files to Git** - Team needs them
❌ **Don't mix schema and data migrations** - Keep them separate when possible
❌ **Don't delete old migrations** - They're part of version history

### Writing Good Migrations

**Good Migration:**

```python
def upgrade():
    # Add new column with default value for existing rows
    op.add_column('users', sa.Column('phone_number', sa.String(20), nullable=True))
def downgrade():
    # Clean rollback
    op.drop_column('users', 'phone_number')
```

**Complex Migration:**

```python
def upgrade():
    # Add column as nullable first
    op.add_column('users', sa.Column('full_name', sa.String(200), nullable=True))

    # Populate data
    connection = op.get_bind()
    connection.execute(
        text("UPDATE users SET full_name = first_name || ' ' || last_name")
    )

    # Make non-nullable after populating
    op.alter_column('users', 'full_name', nullable=False)

def downgrade():
    op.drop_column('users', 'full_name')
```

## Migration File Structure

Migrations are stored in `backend/alembic/versions/`:

```
backend/
├── alembic/
│   ├── versions/
│   │   ├── 001_initial_schema.py      # Base schema
│   │   ├── 002_add_phone_to_users.py  # Your migrations
│   │   └── 003_add_preferences.py
│   ├── env.py                          # Alembic environment config
│   ├── script.py.mako                  # Migration template
│   └── README
├── alembic.ini                         # Alembic configuration
├── migrations.py                       # Helper CLI tool
└── init_db.py                          # Data initialization
```

## Additional Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Flask-SQLAlchemy Documentation](https://flask-sqlalchemy.palletsprojects.com/)

## Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review Alembic documentation
3. Check migration history: `alembic history --verbose`
4. Examine the migration files in `alembic/versions/`
5. Ask the team in Slack/Discord
