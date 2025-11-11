#!/bin/sh
# Initialize database schema and seed data
# This script constructs DATABASE_URL from environment variables and runs Prisma migrations

set -e

# Construct DATABASE_URL from individual environment variables
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

echo "=== Database Initialization ==="
echo "Target database: postgresql://${POSTGRES_USER}:***@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

# Push Prisma schema to database (creates/updates tables without migrations)
echo "Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

# Run data seeding
echo "Seeding default data..."
node scripts/db-init.mjs

echo "=== Database initialization completed ==="
