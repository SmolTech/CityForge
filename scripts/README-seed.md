# Database Seeding Script

The `seed-database.mjs` script is designed for Kubernetes deployments using PostgreSQL operator secrets and config maps.

## Environment Variables

The script requires these PostgreSQL connection variables:

### Required (from PostgreSQL operator secret)

- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password

### Required (from config map)

- `POSTGRES_HOST` - Database hostname (e.g., "cityforge-db")
- `POSTGRES_DB` - Database name (e.g., "cityforge")

### Optional

- `POSTGRES_PORT` - Database port (defaults to "5432")
- `DATABASE_URL` - If set, overrides the constructed URL

### Admin User Creation

- `ADMIN_EMAIL` - Email for admin user (optional)
- `ADMIN_PASSWORD` - Password for admin user (optional)

### Behavior Control

- `SEED_SAMPLE_DATA` - Set to "false" to skip sample data seeding
- `NODE_ENV` - Environment name for logging

## Usage

### Run with npm script:

```bash
npm run seed-database
```

### Run directly:

```bash
node scripts/seed-database.mjs
```

### In Kubernetes:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: cityforge-seed
spec:
  template:
    spec:
      containers:
        - name: seed
          image: cityforge:latest
          command: ["node", "scripts/seed-database.mjs"]
          env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: password
            - name: POSTGRES_HOST
              valueFrom:
                configMapKeyRef:
                  name: cityforge-config
                  key: postgres-host
            - name: POSTGRES_DB
              valueFrom:
                configMapKeyRef:
                  name: cityforge-config
                  key: postgres-db
            - name: POSTGRES_PORT
              value: "5432"
            - name: ADMIN_EMAIL
              value: "admin@example.com"
            - name: ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: admin-credentials
                  key: password
      restartPolicy: OnFailure
```

## What it does

1. **Validates Environment Variables** - Ensures all required PostgreSQL connection variables are present
2. **Constructs Database URL** - Builds `DATABASE_URL` from individual components if not already set
3. **Runs Migrations** - Executes `prisma migrate deploy` to ensure schema is up-to-date
4. **Initializes Core Data** - Creates:
   - Resource categories (Government Services, Healthcare, etc.)
   - Site configuration (title, description, etc.)
5. **Creates Admin User** - If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are provided
6. **Seeds Sample Data** - Unless `SEED_SAMPLE_DATA=false`, creates:
   - Sample business tags
   - Forum categories
   - Sample business cards
   - Demonstrates the complete data model

## Safe to run multiple times

The script uses `upsert` operations where possible, making it safe to run multiple times without creating duplicates.

## Output

The script provides detailed logging with emojis for easy reading:

- ✅ Success messages
- ❌ Error messages
- ⚠️ Warning messages
- 📊 Statistics
- 🔗 Connection info (with password masked)
