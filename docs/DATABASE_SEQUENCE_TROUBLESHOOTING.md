# Database Sequence Troubleshooting

## Problem: Unique Constraint Violation on ID Field

### Symptoms

When creating new records, you may encounter Prisma errors like:

```
Invalid `prisma.cardModification.create()` invocation:
Unique constraint failed on the fields: (`id`)
```

Error code: `P2002`

### Root Cause

PostgreSQL auto-increment sequences become out of sync with the actual data in the table. This typically happens when:

1. **Data is imported/restored** from a backup without updating sequences
2. **Manual inserts** are performed with explicit ID values
3. **Database migrations** don't properly update sequences
4. **Replication issues** cause sequence desynchronization

### Diagnosis

Check if sequences are out of sync by comparing the maximum ID in each table with the current sequence value:

```bash
# For worcester namespace
cat scripts/check-all-sequences.sql | kubectl exec -n worcester -i cityforge-db-0 -- psql -U postgres -d cityforge

# For shrewsbuddy namespace
cat scripts/check-all-sequences.sql | kubectl exec -n shrewsbuddy -i cityforge-db-0 -- psql -U postgres -d cityforge
```

**Expected Result**: `seq_value` should be >= `max_id` for each table

**Problem Indicator**: If `seq_value` < `max_id`, the sequence is out of sync

### Fix

**Option 1: Use the npm script (recommended)**

```bash
npm run fix-sequences
```

This runs the automated sequence fixer that updates all sequences to match their table's max IDs.

**Option 2: Use the SQL script (for production deployments)**

```bash
# For worcester namespace
cat scripts/fix-all-sequences.sql | kubectl exec -n worcester -i cityforge-db-0 -- psql -U postgres -d cityforge

# For shrewsbuddy namespace
cat scripts/fix-all-sequences.sql | kubectl exec -n shrewsbuddy -i cityforge-db-0 -- psql -U postgres -d cityforge
```

**Option 3: Run the standalone JavaScript tool**

```bash
node scripts/fix-sequences.mjs
```

### Manual Fix for Individual Tables

If you need to fix a single table:

```sql
-- Replace 'table_name' with your actual table name
SELECT setval('table_name_id_seq', (SELECT COALESCE(MAX(id), 1) FROM table_name), true);
```

Example for `card_modifications`:

```sql
SELECT setval('card_modifications_id_seq', (SELECT COALESCE(MAX(id), 1) FROM card_modifications), true);
```

### Prevention

1. **After Database Restores**: Always run `npm run fix-sequences` after restoring from a backup

2. **After Manual Inserts**: If you manually insert records with explicit IDs, update the sequence:

   ```sql
   SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name), true);
   ```

3. **Add to Migrations**: When migrating data, include sequence updates:

   ```sql
   -- At the end of your migration
   SELECT setval(pg_get_serial_sequence('table_name', 'id'), COALESCE(MAX(id), 1), true)
   FROM table_name;
   ```

4. **Automated Checks**: Add sequence checks to your CI/CD pipeline or monitoring

5. **Automatic Fix**: As of v0.9.6+, the data import system automatically resets sequences:
   - **API Endpoint** (`/api/admin/data/import`): Automatically resets sequences after import
   - **CLI Import** (`scripts/flask-data-import.mjs`): Automatically resets sequences after import

   If you're using older import code or custom import scripts, make sure to add sequence reset logic.

### Verification

After applying the fix, verify all sequences are correct:

```bash
cat scripts/check-all-sequences.sql | kubectl exec -n worcester -i cityforge-db-0 -- psql -U postgres -d cityforge
```

All tables should show `seq_value >= max_id`.

### Historical Context

**Issue Date**: 2025-11-28

**Affected Tables (worcester namespace)**:

- `cards`: max_id=42, seq=1 ❌
- `card_submissions`: max_id=35, seq=1 ❌
- `tags`: max_id=89, seq=1 ❌
- `forum_categories`: max_id=3, seq=1 ❌
- `card_modifications`: max_id=7, seq=5 ❌

**Root Cause**: Data import/export system was not resetting sequences after importing data with explicit IDs

**Resolution**:

1. Fixed immediate issue: Synchronized all sequences using `fix-all-sequences.sql`

2. Fixed root cause: Updated both API endpoint and CLI import script to automatically reset sequences
3. Created tools: Added `npm run fix-sequences` command for easy manual fixes

**Code Changes**:

- `src/app/api/admin/data/import/route.ts`: Added automatic sequence reset after transaction
- `scripts/flask-data-import.mjs`: Improved sequence reset logic with better error reporting
- `scripts/fix-sequences.mjs`: New standalone tool for fixing sequences
- `package.json`: Added `fix-sequences` npm script

### Related Scripts

- `scripts/check-all-sequences.sql` - Diagnose sequence sync issues
- `scripts/fix-all-sequences.sql` - Fix all sequence sync issues
- `scripts/check-sequences.sql` - Advanced diagnostic script

### Additional Resources

- [PostgreSQL Sequences Documentation](https://www.postgresql.org/docs/current/sql-createsequence.html)
- [Prisma Error Reference - P2002](https://www.prisma.io/docs/reference/api-reference/error-reference#p2002)
