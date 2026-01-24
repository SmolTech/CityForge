# CityForge

A community platform for business directories, forums, help wanted posts, and resource management.

## Setup

### Prerequisites

- Node.js 20 LTS
- Docker & Docker Compose
- Git

### Quick Start

1. **Clone and install dependencies:**

```bash
git clone <repository-url>
cd CityForge
npm install
npm run prepare  # Set up git hooks
```

2. **Environment configuration:**

```bash
cp .env.example .env.local
# Edit .env.local with your configuration

```

3. **Start with Docker:**

```bash

docker-compose up --build
```

4. **Initialize database (first time only):**

```bash
node scripts/db-init.mjs
```

5. **Access application:**

- Web Interface: http://localhost
- Admin Panel: http://localhost/admin

### Environment Variables

Key environment variables in `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/community_db"

# Security
JWT_SECRET_KEY="your-secret-key-here"

# Optional: External Services
OPENSEARCH_HOST="localhost"
OPENSEARCH_PORT="9200"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
```

See `.env.example` for complete configuration options.

## Testing

### Unit Tests

```bash

npm test                    # Watch mode
npm run test:run            # Run once
npm run test:unit           # Unit tests only
npm run test:coverage       # With coverage report
```

### End-to-End Tests

```bash
npm run test:e2e            # Run E2E tests
npm run test:e2e:ui         # Interactive UI mode
npm run test:e2e:debug      # Debug mode
```

### Code Quality

```bash
npm run lint                # ESLint check
npm run lint:fix            # Auto-fix issues
npm run format              # Prettier formatting
npm run typecheck           # TypeScript check

npm run semgrep             # Security analysis
```

### Database Tests

Integration tests use testcontainers and require Docker to be running.

## Maintenance

### Development Commands

```bash
npm run dev                 # Start development server
npm run build               # Production build
npm start                   # Start production server
```

### Database Operations

```bash
npx prisma generate         # Generate Prisma client
npx prisma db push          # Push schema changes (dev)
npx prisma migrate dev      # Create and apply migrations
npx prisma studio           # Database GUI
node scripts/fix-sequences.mjs  # Fix PostgreSQL sequences
```

### Docker Operations

```bash

docker-compose up -d        # Start in background
docker-compose logs -f      # View logs
docker-compose down         # Stop all services
docker exec -it cityforge-frontend sh  # Shell into container
```

### Git Hooks

Automated quality checks:

- **Pre-commit**: Formatting, linting, security scan
- **Pre-push**: Type check, tests, build verification

### Security Scanning

```bash
npm run semgrep             # Full security analysis
npm run semgrep:ci          # CI-friendly output
```

### Troubleshooting

**Database connection issues:**

```bash

# Check database status
docker-compose ps postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
node scripts/db-init.mjs
```

**Port conflicts:**

```bash
# Check what's using port 3000
lsof -i :3000
```

**Clear cache and rebuild:**

```bash
npm run build:clean
docker-compose down
docker-compose up --build
```

## Migration from v0.8.x

To upgrade from version 0.8.x:

1. Export data from `/admin/data`
2. Convert format: `node scripts/convert-export-to-0.9.0.mjs --input old.json --output new.json`
3. Clean installation and reimport data

## License

GPLv3 License - see LICENSE file for details.
