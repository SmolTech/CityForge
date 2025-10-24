# CityForge Data Management

This document describes the data export/import system for CityForge, which allows you to backup, migrate, and restore database data.

## Overview

The data management system provides two main scripts:

- **`export_data.py`** - Export database data to JSON format
- **`import_data.py`** - Import database data from JSON format

These scripts handle all CityForge models including users, cards, tags, forums, reviews, resources, and configuration data.

## Export Data

### Basic Usage

Export all data to a timestamped JSON file:

```bash
cd backend
python export_data.py
```

This creates a file named `data_export_YYYYMMDD_HHMMSS.json` in the current directory.

### Export to Specific File

```bash
python export_data.py --output /path/to/backup.json
```

### Export Excluding Models

Exclude operational data like indexing jobs and token blacklist:

```bash
python export_data.py --exclude IndexingJob,TokenBlacklist
```

### Export Only Specific Models

Export only users and cards:

```bash
python export_data.py --include User,Card,Tag
```

### Available Models

- **Core**: `User`, `Card`, `Tag`
- **Card Management**: `CardSubmission`, `CardModification`, `Review`
- **Resources**: `ResourceCategory`, `ResourceItem`, `QuickAccessItem`, `ResourceConfig`
- **Forums**: `ForumCategory`, `ForumCategoryRequest`, `ForumThread`, `ForumPost`, `ForumReport`
- **Classifieds**: `HelpWantedPost`, `HelpWantedComment`, `HelpWantedReport`
- **Operational**: `IndexingJob`, `TokenBlacklist`

### Export Format

The export file is JSON with the following structure:

```json
{
  "export_metadata": {
    "timestamp": "2025-10-24T14:30:00.000000",
    "version": "1.0",
    "database": "cityforge"
  },
  "data": {
    "User": [...],
    "Card": [...],
    "Tag": [...]
  },
  "relationships": {
    "card_tags": [
      {"card_id": 1, "tag_id": 5},
      {"card_id": 1, "tag_id": 12}
    ]
  }
}
```

## Import Data

### Import Modes

The import script supports four modes:

1. **`skip`** (default) - Skip records that already exist (safest)
2. **`replace`** - Replace existing records with imported data
3. **`merge`** - Update existing records, add new ones (same as replace)
4. **`clean`** - Delete all existing data before import ⚠️ **DESTRUCTIVE!**

### Basic Usage

Import from backup file, skipping existing records:

```bash
cd backend
python import_data.py --input backup.json
```

### Replace All Data (Clean Import)

⚠️ **WARNING: This deletes all existing data!**

```bash
python import_data.py --input backup.json --mode clean
```

You will be prompted to type `DELETE ALL DATA` to confirm.

### Merge/Update Data

Update existing records and add new ones:

```bash
python import_data.py --input backup.json --mode merge
```

### Import Only Specific Models

Import only users and cards:

```bash
python import_data.py --input backup.json --include User,Card,Tag
```

## Common Use Cases

### 1. Regular Backup

Create a daily backup excluding operational data:

```bash
# Export
python export_data.py \
  --output /backups/cityforge_$(date +%Y%m%d).json \
  --exclude IndexingJob,TokenBlacklist
```

Add to cron for automated backups:

```bash
# Daily backup at 3 AM
0 3 * * * cd /path/to/backend && python export_data.py --output /backups/cityforge_$(date +\%Y\%m\%d).json --exclude IndexingJob,TokenBlacklist
```

### 2. Migrate to New Instance

**On source instance:**

```bash
# Export all data
python export_data.py --output migration.json
```

**On destination instance:**

```bash
# Initialize fresh database
python initialize_db.py

# Import data
python import_data.py --input migration.json --mode clean
```

### 3. Restore from Backup

```bash
# Restore, replacing all data
python import_data.py --input /backups/cityforge_20251024.json --mode clean
```

### 4. Copy Production Data to Staging

**On production:**

```bash
# Export excluding sensitive operational data
python export_data.py \
  --output prod_export.json \
  --exclude TokenBlacklist,IndexingJob
```

**On staging:**

```bash
# Import, replacing staging data
python import_data.py --input prod_export.json --mode clean
```

### 5. Seed Development Database

**Export seed data from production:**

```bash
# Export only configuration and sample cards
python export_data.py \
  --output seed_data.json \
  --include ResourceConfig,ResourceCategory,ResourceItem,QuickAccessItem,Tag
```

**Import to development:**

```bash
python import_data.py --input seed_data.json --mode merge
```

### 6. Recover Deleted Data

If you have a recent backup before deletion:

```bash
# Import specific models, skipping existing records
python import_data.py \
  --input backup_before_deletion.json \
  --include Card,Tag \
  --mode skip
```

## Kubernetes / Production Usage

### Export from Kubernetes Pod

```bash
# Get backend pod name
POD=$(kubectl get pods -n cityforge -l app=cityforge-backend -o jsonpath='{.items[0].metadata.name}')

# Run export
kubectl exec -n cityforge $POD -- python export_data.py --output /tmp/export.json

# Copy export file to local machine
kubectl cp cityforge/$POD:/tmp/export.json ./backup.json
```

### Import to Kubernetes Pod

```bash
# Get backend pod name
POD=$(kubectl get pods -n cityforge -l app=cityforge-backend -o jsonpath='{.items[0].metadata.name}')

# Copy import file to pod
kubectl cp ./backup.json cityforge/$POD:/tmp/import.json

# Run import
kubectl exec -n cityforge $POD -- python import_data.py --input /tmp/import.json --mode skip
```

### Create Kubernetes CronJob for Backups

Create `k8s/backup-cronjob.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cityforge-backup
  namespace: cityforge
spec:
  schedule: "0 3 * * *" # Daily at 3 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: ghcr.io/smoltech/cityforge-backend
              command:
                - /bin/sh
                - -c
                - |
                  python export_data.py \
                    --output /backups/cityforge_$(date +%Y%m%d_%H%M%S).json \
                    --exclude IndexingJob,TokenBlacklist
              env:
                - name: POSTGRES_HOST
                  value: "cityforge-db"
                - name: POSTGRES_PORT
                  value: "5432"
                - name: POSTGRES_DB
                  value: "cityforge"
                - name: POSTGRES_USER
                  valueFrom:
                    secretKeyRef:
                      key: username
                      name: cityforge.cityforge-db.credentials.postgresql.acid.zalan.do
                - name: POSTGRES_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      key: password
                      name: cityforge.cityforge-db.credentials.postgresql.acid.zalan.do
              volumeMounts:
                - name: backup-storage
                  mountPath: /backups
          volumes:
            - name: backup-storage
              persistentVolumeClaim:
                claimName: backup-pvc
          restartPolicy: OnFailure
```

## Best Practices

### 1. Regular Backups

- Schedule daily backups
- Keep at least 7 days of backups
- Store backups in multiple locations
- Test restores regularly

### 2. Pre-Migration Checklist

Before importing data to a new instance:

- [ ] Initialize database with `initialize_db.py`
- [ ] Verify database schema version matches source
- [ ] Test with `--mode skip` first
- [ ] Backup destination database before using `--mode clean`
- [ ] Verify all expected models are in export file

### 3. Security

- **Never commit export files to git** (they contain user data)
- Add `*.json` to `.gitignore` for backend directory
- Encrypt backup files when storing remotely
- Sanitize user data (emails, passwords) for dev/test environments

### 4. Performance

- Large exports (>100MB) may take several minutes
- Use `--exclude` to skip large operational tables when not needed
- Import in `skip` mode is faster than `merge` mode
- Consider using database snapshots for very large databases

### 5. Error Handling

If import fails:

1. Check error message for specific model/record causing issue
2. Verify foreign key dependencies exist (e.g., User before Card)
3. Check database schema is up to date (`flask db upgrade`)
4. Try importing models incrementally with `--include`

## Troubleshooting

### "Foreign key constraint failed"

Cause: Imported record references a parent record that doesn't exist.

Solution:

```bash
# Import parent models first
python import_data.py --input backup.json --include User,Tag --mode skip
python import_data.py --input backup.json --include Card --mode skip
```

### "Duplicate key value violates unique constraint"

Cause: Record with same primary key already exists, and mode is not `replace` or `merge`.

Solutions:

- Use `--mode merge` to update existing records
- Use `--mode skip` to skip duplicates
- Use `--mode clean` to replace all data

### "File is too large"

Cause: Export file exceeds available memory.

Solutions:

- Export models separately using `--include`
- Use database dump/restore instead for very large databases
- Increase available memory

### "Invalid export file format"

Cause: JSON file is corrupted or wrong version.

Solutions:

- Verify JSON is valid: `python -m json.tool backup.json > /dev/null`
- Re-export from source if file is corrupted
- Check export version matches import script version

## Limitations

1. **Passwords are exported as hashes** - Users will retain their existing passwords when imported
2. **File uploads are not included** - Only database records are exported; uploaded files in `uploads/` directory must be copied separately
3. **Auto-increment sequences** - Primary key sequences may need manual reset after import
4. **Database-specific features** - Some PostgreSQL-specific features may not translate to other databases

## Additional Resources

- [Database Migrations](./CLAUDE.md#database-migrations)
- [Database Initialization](./CLAUDE.md#database-initialization)
- [Kubernetes Deployment](../k8s/)
