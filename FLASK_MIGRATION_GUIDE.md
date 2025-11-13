# Flask to Next.js Migration Guide

This guide provides complete instructions for migrating data from a Flask/SQLAlchemy CityForge deployment to the new Next.js/Prisma architecture.

## Overview

The migration consists of two main steps:

1. **Export** data from your Flask deployment
2. **Import** data into your Next.js deployment

The migration tools preserve data integrity, relationships, and existing IDs to ensure seamless continuity.

## Prerequisites

- **Source Environment**: Working Flask/SQLAlchemy CityForge deployment
- **Target Environment**: Next.js/Prisma CityForge deployment (this repository)
- **Database Access**: Connection credentials for both source and target databases
- **Node.js**: Version 18+ with npm or similar package manager

## Quick Start

### 1. Export Data from Flask Deployment

```bash
# Export all data from Flask database
node scripts/flask-data-export.mjs \
  --source-db "postgresql://user:pass@host:5432/flask_db" \
  --output ./migration-export
```

### 2. Import Data to Next.js Deployment

```bash
# Test import (dry-run mode)
node scripts/flask-data-import.mjs \
  --input ./migration-export \
  --dry-run

# Perform actual import
node scripts/flask-data-import.mjs \
  --input ./migration-export
```

## Detailed Instructions

### Step 1: Data Export

The export script connects to your Flask database and extracts all data into JSON files.

**Basic Export:**

```bash
node scripts/flask-data-export.mjs \
  --source-db "postgresql://user:password@host:port/database_name" \
  --output ./export-directory
```

**Export Options:**

- `--source-db`: PostgreSQL connection string for Flask database (required)
- `--output`: Directory to create export files (required)
- `--tables`: Comma-separated list of specific tables to export (optional)
- `--batch-size`: Number of records per batch for large tables (default: 1000)

**Export Output:**

- Creates timestamped directory with JSON files for each table
- Includes `export-metadata.json` with export summary
- Preserves exact database values including IDs, timestamps, and relationships

**Example:**

```bash
# Export to timestamped directory
node scripts/flask-data-export.mjs \
  --source-db "postgresql://cityforge_user:secure_password@production-db.example.com:5432/cityforge_flask" \
  --output ./exports

# Export specific tables only
node scripts/flask-data-export.mjs \
  --source-db "postgresql://..." \
  --output ./partial-export \
  --tables "users,cards,tags,card_tags"
```

### Step 2: Pre-Import Preparation

**Backup Target Database:**

```bash
# Create backup of your Next.js database before import
pg_dump postgresql://target_db_connection > pre-migration-backup.sql
```

**Validate Export:**

```bash
# Check export contents
ls -la ./export-directory/
cat ./export-directory/export-metadata.json
```

### Step 3: Data Import

**Dry Run (Recommended First Step):**

```bash
# Test import without making changes
node scripts/flask-data-import.mjs \
  --input ./export-directory \
  --dry-run
```

The dry run shows exactly what would be imported without making any database changes.

**Production Import:**

```bash
# Import all data
node scripts/flask-data-import.mjs \
  --input ./export-directory
```

**Import Options:**

- `--input`: Directory containing export files (required)
- `--dry-run`: Preview import without making changes
- `--skip-existing`: Skip records that already exist (by ID)
- `--lenient`: Continue on errors instead of stopping
- `--verbose`: Show detailed error information

**Advanced Import Scenarios:**

```bash
# Skip existing records (for incremental imports)
node scripts/flask-data-import.mjs \
  --input ./export-directory \
  --skip-existing

# Continue on errors (for partially corrupted exports)
node scripts/flask-data-import.mjs \
  --input ./export-directory \
  --lenient \
  --verbose
```

## Migration Process Details

### Data Transformation

The import automatically handles differences between Flask and Next.js schemas:

**Field Name Conversion:**

- `created_date` → `createdDate` (snake_case → camelCase)
- `website_url` → `websiteUrl`
- `is_active` → `isActive`

**Data Type Conversion:**

- String booleans (`"true"`, `"false"`) → actual booleans
- ISO date strings → JavaScript Date objects
- Null value handling and validation

**Relationship Preservation:**

- Foreign key references maintained
- Join table relationships preserved
- Auto-increment sequences reset to prevent conflicts

### Import Order

Tables are imported in dependency order to maintain referential integrity:

1. **Core Entities**: `users`, `tags`, `resource_categories`, `resource_config`
2. **Main Content**: `cards`, `resource_items`, `quick_access_items`
3. **Relationships**: `card_tags`
4. **Submissions**: `card_submissions`, `card_modifications`
5. **Forum System**: `forum_categories`, `forum_threads`, `forum_posts`
6. **Supporting Data**: `reviews`, `support_tickets`, `indexing_jobs`, `token_blacklist`

### ID Preservation

**Important**: The migration preserves original record IDs to maintain data consistency:

- User references remain valid
- URLs with ID parameters continue working
- External integrations maintain correct references
- Database sequences are automatically reset after import

## Validation and Testing

### Automated Validation

The import script includes built-in validation:

- **Record counts** for each imported table
- **Relationship integrity** checks
- **Critical data** verification (admin users, featured cards, etc.)

### Manual Verification Steps

After migration, verify these key areas:

1. **User Authentication:**

   ```bash
   # Test admin login
   # Check user roles and permissions
   ```

2. **Business Directory:**

   ```bash
   # Verify card listings load correctly
   # Check card details and images
   # Test tag filtering
   ```

3. **Resource Directory:**

   ```bash
   # Verify resource categories and items
   # Check quick access items
   ```

4. **Forum System:**

   ```bash
   # Test forum categories and threads
   # Verify post content and relationships
   ```

5. **Admin Functions:**
   ```bash
   # Test admin dashboard access
   # Check submission moderation
   # Verify user management
   ```

## Production Deployment Workflow

### Complete Migration Process

```bash
# 1. Export from Flask production
node scripts/flask-data-export.mjs \
  --source-db "postgresql://prod_user:secure_pass@flask-db.prod:5432/cityforge" \
  --output ./production-export-$(date +%Y%m%d_%H%M%S)

# 2. Copy export to Next.js environment
scp -r ./production-export-* user@nextjs-server:/opt/cityforge/

# 3. Test import on Next.js staging
node scripts/flask-data-import.mjs \
  --input ./production-export-* \
  --dry-run

# 4. Backup Next.js production database
pg_dump postgresql://nextjs_prod_connection > pre-migration-backup-$(date +%Y%m%d_%H%M%S).sql

# 5. Import to Next.js production
node scripts/flask-data-import.mjs \
  --input ./production-export-*

# 6. Validate migration results
# Test critical functionality manually
```

## Troubleshooting

### Common Issues

**Export Failures:**

- **Connection refused**: Check Flask database connection string and network access
- **Permission denied**: Ensure database user has SELECT permissions on all tables
- **Out of memory**: Use `--batch-size` option for large tables

**Import Failures:**

- **Duplicate key errors**: Use `--skip-existing` flag or clear target database first
- **Foreign key violations**: Check that all dependent tables were exported and imported
- **Type conversion errors**: Review export data for unexpected null values or formats

**Data Validation Issues:**

- **Missing relationships**: Ensure complete export included all related tables
- **Incorrect counts**: Check for failed imports in specific tables
- **Authentication problems**: Verify user password hashes were preserved correctly

### Recovery Procedures

**If Import Fails Mid-Process:**

```bash
# Clear partial import
node scripts/test-migration-workflow.mjs --clear-only

# Restore from backup
psql postgresql://connection < pre-migration-backup.sql

# Retry import with --lenient flag
node scripts/flask-data-import.mjs \
  --input ./export-directory \
  --lenient \
  --verbose
```

**If Data Corruption Detected:**

```bash
# Restore from backup
psql postgresql://connection < pre-migration-backup.sql

# Export specific tables only
node scripts/flask-data-export.mjs \
  --source-db "..." \
  --output ./targeted-export \
  --tables "users,cards,tags"

# Import with validation
node scripts/flask-data-import.mjs \
  --input ./targeted-export \
  --verbose
```

## Testing and Validation

### Automated Testing

Test the complete migration workflow:

```bash
# Run comprehensive migration test
node scripts/test-migration-workflow.mjs
```

This test:

- Creates sample data in all tables
- Exports the data to temporary files
- Clears the database
- Imports the data back
- Validates data integrity and relationships

### Performance Considerations

**Large Database Migrations:**

- Export during low-traffic periods
- Use smaller batch sizes for memory-constrained environments
- Consider table-by-table migration for databases > 10GB
- Monitor disk space during export/import processes

**Downtime Minimization:**

1. Perform dry-run imports to identify potential issues
2. Use database replication for near-zero downtime migrations
3. Pre-validate export data before production import
4. Have rollback procedures tested and ready

## Security Considerations

**Database Security:**

- Use read-only database users for exports when possible
- Ensure secure network connections (SSL/TLS) for database access
- Store connection credentials securely (environment variables, secrets management)

**Data Privacy:**

- Review exported data for sensitive information
- Encrypt export files if transferring over networks
- Secure delete temporary export files after successful migration

**Access Control:**

- Verify user roles and permissions are preserved
- Test authentication with migrated user accounts
- Confirm admin access and capabilities

## Support and Monitoring

**Migration Logs:**

- Export and import scripts provide detailed logging
- Review logs for warnings or error messages
- Keep migration logs for audit purposes

**Post-Migration Monitoring:**

- Monitor application performance after migration
- Watch for authentication issues or permission errors
- Track user activity to ensure normal operation

**Rollback Planning:**

- Maintain database backups before any migration
- Test rollback procedures in development environment
- Document recovery steps for emergency situations

## Migration Checklist

### Pre-Migration

- [ ] Flask database backup created
- [ ] Next.js database backup created
- [ ] Export tools tested in development
- [ ] Import tools tested with sample data
- [ ] Network connectivity verified
- [ ] Sufficient disk space available
- [ ] Maintenance window scheduled

### During Migration

- [ ] Flask data exported successfully
- [ ] Export data validated and complete
- [ ] Dry-run import completed without errors
- [ ] Production import completed successfully
- [ ] Automated validation passed

### Post-Migration

- [ ] Manual testing of critical functionality
- [ ] User authentication tested
- [ ] Admin functions verified
- [ ] External integrations tested
- [ ] Performance monitoring active
- [ ] Migration logs archived
- [ ] Temporary files cleaned up

## Conclusion

This migration process provides a robust, tested pathway from Flask/SQLAlchemy to Next.js/Prisma while preserving all data integrity and relationships. The automated validation and testing ensure reliable migrations suitable for production environments.

For questions or issues not covered in this guide, please review the migration script source code or create an issue in the project repository.
