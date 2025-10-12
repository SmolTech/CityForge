# Migration Guide: 0.6.6 → 0.7.0

This guide covers the database schema changes and migration steps needed to upgrade from version 0.6.6 to 0.7.0.

## Overview of Changes

Version 0.7.0 includes significant changes to the review system:

- Converted from **approval-based** to **reporting-based** workflow
- Reviews are now published immediately instead of requiring admin approval
- Users can report inappropriate reviews for admin moderation
- Added admin interface for managing reported reviews

## Database Schema Changes

### Review Table Changes

**Removed columns:**

- `approved` (BOOLEAN)
- `approved_by` (INTEGER, FK to users)
- `approved_date` (TIMESTAMP)

**Added columns:**

- `reported` (BOOLEAN, default: FALSE) - Whether review has been reported
- `reported_by` (INTEGER, FK to users, nullable) - User who reported the review
- `reported_date` (TIMESTAMP, nullable) - When review was reported
- `reported_reason` (TEXT, nullable) - Reason for reporting
- `hidden` (BOOLEAN, default: FALSE) - Whether review is hidden from public view

## Migration Steps

### Prerequisites

Before migrating:

1. **Backup your database** - This is critical!

   ```bash
   # For PostgreSQL
   pg_dump -U username -d cityforge > backup_before_0.7.0.sql

   # For SQLite
   cp cityforge.db cityforge.db.backup
   ```

2. **Stop the application** to prevent data corruption during migration

### Running the Migration

#### Option 1: Automated Migration Script (Recommended)

The migration script handles both PostgreSQL and SQLite databases:

```bash
cd backend
python migrate_reviews_to_reporting.py
```

The script will:

- Auto-detect your database type (PostgreSQL or SQLite)
- Check if migration is needed (safe to run multiple times)
- Create new schema with reporting columns
- Migrate existing data:
  - **Approved reviews** → visible (hidden=FALSE)
  - **Pending reviews** → hidden (hidden=TRUE)
- Remove old approval-based columns
- Create necessary indexes

#### Option 2: Manual PostgreSQL Migration

If you prefer to run the migration manually:

```sql
-- Add new columns
ALTER TABLE reviews ADD COLUMN reported BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE reviews ADD COLUMN reported_by INTEGER REFERENCES users(id);
ALTER TABLE reviews ADD COLUMN reported_date TIMESTAMP;
ALTER TABLE reviews ADD COLUMN reported_reason TEXT;
ALTER TABLE reviews ADD COLUMN hidden BOOLEAN DEFAULT FALSE NOT NULL;

-- Migrate data: unapproved reviews become hidden
UPDATE reviews SET hidden = TRUE WHERE approved = FALSE;

-- Drop old columns
ALTER TABLE reviews DROP COLUMN approved;
ALTER TABLE reviews DROP COLUMN approved_by;
ALTER TABLE reviews DROP COLUMN approved_date;

-- Create indexes for performance
CREATE INDEX ix_reviews_reported ON reviews(reported);
CREATE INDEX ix_reviews_hidden ON reviews(hidden);
```

### Verifying the Migration

After running the migration, verify it was successful:

```bash
cd backend
python -c "
from app import create_app, db
app = create_app()
with app.app_context():
    inspector = db.inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns('reviews')]
    print('Review table columns:', columns)
    assert 'reported' in columns, 'Migration failed: reported column missing'
    assert 'hidden' in columns, 'Migration failed: hidden column missing'
    assert 'approved' not in columns, 'Migration failed: old approved column still exists'
    print('✓ Migration verified successfully!')
"
```

### Post-Migration Steps

1. **Update your deployment**:

   ```bash
   # Pull the latest code
   git pull origin main

   # Rebuild containers if using Docker
   docker-compose build
   docker-compose up -d
   ```

2. **Test the application**:
   - Submit a test review (should appear immediately)
   - Report a review as a regular user
   - Check the admin dashboard → Reviews tab
   - Verify reported reviews appear with the report reason
   - Test hide/unhide/dismiss/delete actions

3. **Monitor for issues**:
   - Check application logs for any errors
   - Verify review counts are correct
   - Test that existing reviews display properly

## Rollback Procedure

If you need to rollback to 0.6.6:

1. **Stop the application**

2. **Restore the database backup**:

   ```bash
   # PostgreSQL
   psql -U username -d cityforge < backup_before_0.7.0.sql

   # SQLite
   cp cityforge.db.backup cityforge.db
   ```

3. **Checkout version 0.6.6**:
   ```bash
   git checkout v0.6.6  # or the specific commit
   docker-compose build
   docker-compose up -d
   ```

## Troubleshooting

### "Migration already completed" message

This is safe - the script detected that the migration was already run. No action needed.

### Foreign key constraint errors

Ensure no other processes are accessing the database during migration.

### "Column already exists" errors

The database may be in an inconsistent state. Restore from backup and try again.

### Reviews not appearing after migration

Check the `hidden` column - previously pending reviews are marked as hidden. You can unhide them from the admin dashboard if desired.

## Additional Notes

- The migration is **idempotent** - safe to run multiple times
- Both PostgreSQL and SQLite are supported
- Existing review data is preserved
- Previously approved reviews remain visible
- Previously pending reviews become hidden (admins can unhide them if needed)
- The migration script creates appropriate indexes for performance

## Support

If you encounter issues:

1. Check the application logs: `docker-compose logs -f backend`
2. Verify your database backup is good before attempting fixes
3. Report issues at: https://github.com/SmolTech/CityForge/issues

---

**Important**: Always test migrations in a staging environment before applying to production!
