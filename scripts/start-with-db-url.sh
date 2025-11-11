#!/bin/sh
# Construct DATABASE_URL from individual environment variables
# This runs at container startup, ensuring environment variables are available

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

echo "Starting with DATABASE_URL: postgresql://${POSTGRES_USER}:***@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

# Start the Next.js server
exec node server.js
