# Database Migrations

This directory contains database migration scripts for CityForge.

## Available Migrations

### Recent Migrations

1. **migrate_reviews_to_reporting.py** (v0.7.0)
   - Converts review system from approval-based to reporting-based
   - Required for: v0.6.6 → v0.7.0 upgrade
   - See: [MIGRATION_0.6.6_to_0.7.0.md](../MIGRATION_0.6.6_to_0.7.0.md)

2. **migrate_help_wanted.py** (v0.6.7)
   - Adds Help Wanted gig board feature
   - Creates `help_wanted_posts`, `help_wanted_comments`, `help_wanted_reports` tables
   - Auto-runs on first deployment

3. **migrate_add_report_count.py**
   - Adds `report_count` column to help wanted posts
   - For tracking number of reports per post

### Legacy Migrations

- **migrate_address_override.py** - Adds custom address URL override
- **migrate_tags.py** - Initial tag system setup

## Running Migrations

### For Version Upgrades

When upgrading between versions, check the release notes or version-specific migration guide:

```bash
cd backend
python migrate_<migration_name>.py
```

### Checking Migration Status

Migrations are idempotent and will skip if already applied:

```bash
python migrate_reviews_to_reporting.py
# Output: "Migration already completed - reported column exists"
```

## Best Practices

1. **Always backup first**:

   ```bash
   # PostgreSQL
   pg_dump -U username -d cityforge > backup_$(date +%Y%m%d_%H%M%S).sql

   # SQLite
   cp cityforge.db cityforge.db.backup_$(date +%Y%m%d_%H%M%S)
   ```

2. **Stop the application** before migrating

3. **Test in staging** before production

4. **Verify after migration**:
   ```bash
   # Example verification
   python -c "from app import create_app, db; app = create_app(); ..."
   ```

## Database Support

All migrations support:

- **PostgreSQL** (production)
- **SQLite** (development)

The scripts auto-detect your database type and use the appropriate SQL syntax.

## Creating New Migrations

When creating a new migration script:

1. **Name it descriptively**: `migrate_<feature_name>.py`

2. **Make it idempotent**: Check if migration is needed first

   ```python
   inspector = db.inspect(db.engine)
   columns = [col["name"] for col in inspector.get_columns("table_name")]
   if "new_column" in columns:
       print("Migration already completed")
       return
   ```

3. **Support both databases**: Use conditional logic for PostgreSQL vs SQLite

4. **Document the migration**: Add a docstring explaining what it does

5. **Test thoroughly**: Test on both fresh databases and existing data

## Troubleshooting

### Migration fails midway

Restore from backup and fix the issue before retrying.

### "Column already exists"

The database may be in an inconsistent state. Check if partial migration occurred.

### Foreign key errors

Ensure no other processes are accessing the database during migration.

## Migration History

| Version | Migration                       | Description            |
| ------- | ------------------------------- | ---------------------- |
| 0.7.0   | migrate_reviews_to_reporting.py | Review system overhaul |
| 0.6.7   | migrate_help_wanted.py          | Help Wanted feature    |
| 0.6.x   | migrate_add_report_count.py     | Report counting        |
| 0.6.x   | migrate_address_override.py     | Custom address URLs    |
| 0.6.x   | migrate_tags.py                 | Tag system             |

## Support

For migration issues:

- Check application logs
- Verify database state
- Report issues: https://github.com/SmolTech/CityForge/issues
