#!/bin/sh
set -e

# Create runtime configuration file from environment variables in /tmp (always writable)
# This file is read by the Next.js app at runtime and cannot be inlined at build time
cat > /tmp/runtime-config.json << EOCONFIG
{
  "siteUrl": "${SITE_URL:-${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}}"
}
EOCONFIG

echo "Created /tmp/runtime-config.json with SITE_URL=${SITE_URL:-${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}}"

# Start the Next.js server
exec "$@"
