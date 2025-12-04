FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Install dependencies with busybox trigger error tolerance for ARM64
RUN (apk add --no-cache gcompat curl || true) && \
    if ! apk info gcompat curl >/dev/null 2>&1; then \
        echo "Packages not found, attempting with --force-broken-world"; \
        apk add --no-cache --force-broken-world gcompat curl; \
    fi
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Generate Prisma client in separate stage for better caching
FROM base AS prisma
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY package.json ./
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"
RUN npx prisma generate

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

# Set environment variables for build time
ENV NEXT_BUILD_TIME=true
ENV SKIP_DATABASE_HEALTH_CHECK=true
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

# Build the application (Prisma client already generated)
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
# Install curl for health checks
# Install curl with busybox trigger error tolerance for ARM64
RUN (apk add --no-cache curl || true) && \
    if ! apk info curl >/dev/null 2>&1; then \
        echo "Package not found, attempting with --force-broken-world"; \
        apk add --no-cache --force-broken-world curl; \
    fi
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copy database initialization script
COPY --from=builder /app/scripts ./scripts

# Copy entire node_modules for database operations (Prisma requires many dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy Prisma schema for database operations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy entrypoint script for runtime config generation
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use entrypoint to create runtime config before starting server
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
