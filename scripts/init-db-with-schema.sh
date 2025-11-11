#!/bin/sh
# Initialize database schema and seed data
# This script constructs DATABASE_URL from environment variables and runs Prisma migrations

set -e

# Construct DATABASE_URL from individual environment variables
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
export DATABASE_URL

echo "=== Database Initialization ==="
echo "Target database: postgresql://${POSTGRES_USER}:***@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo "YES" || echo "NO")"

# Run Prisma migrations (safe, will not lose data)
echo "Running Prisma migrations..."
npx prisma migrate deploy

# Run data seeding
echo "Seeding default data..."
node scripts/db-init.mjs

echo "=== Database initialization completed ==="
