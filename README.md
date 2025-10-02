# CityForge

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Code Quality**: ESLint + Prettier + Semgrep with git hooks
- **Security**: Semgrep static analysis for vulnerability detection
- **Containerization**: Docker with multi-stage builds
- **Node Version**: 20 LTS

## Development

```bash
# Install dependencies
npm install

# Set up pre-commit script
npm run prepare

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Format code
npm run format

# Type checking
npm run typecheck

# Security analysis
npm run semgrep
```

## Developing With Docker

docker-compose up
docker exec -it cityforge-backend python init_db.py

````

## Security Analysis

The project includes Semgrep for automated security vulnerability detection:

```bash
# Run security analysis
npm run semgrep

# Run security analysis (CI mode - quiet output)
npm run semgrep:ci
````

## Git Hooks

This project includes git hooks for code quality and security:

- **Pre-commit**: Runs lint-staged (ESLint + Prettier) and semgrep security analysis
- **Pre-push**: Runs type checking, linting, semgrep, and build verification

## Project Structure

```
├── src/                   # Frontend application
│   ├── app/               # Next.js app router pages
│   │   ├── admin/         # Admin dashboard
│   │   ├── api/           # API route handlers
│   │   ├── business/      # Business directory pages
│   │   ├── dashboard/     # User dashboard
│   │   ├── login/         # Login page
│   │   ├── register/      # Registration page
│   │   ├── resources/     # Resource directory pages
│   │   ├── search/        # Search interface
│   │   ├── settings/      # User settings
│   │   ├── submit/        # Business card submission
│   │   └── page.tsx       # Homepage
│   ├── components/        # React components
│   └── lib/               # Utilities and API client
├── backend/               # Flask API backend
│   ├── app/               # Application modules
│   │   ├── models.py      # Database models
│   │   ├── routes/        # API endpoints
│   │   └── utils/         # Helper functions
│   ├── tests/             # Backend tests
│   ├── uploads/           # Uploaded files
│   ├── app.py             # Flask application
│   ├── init_db.py         # Database initialization
│   └── requirements.txt   # Python dependencies
├── indexer/               # OpenSearch indexing service
│   ├── indexer.py         # Website crawler and indexer
│   └── requirements.txt   # Python dependencies
├── .github/
│   └── workflows/         # GitHub Actions CI/CD
├── .husky/                # Git hooks
├── public/                # Static assets
├── scripts/               # Build and deployment scripts
├── templates/             # Email templates
├── Dockerfile             # Frontend container
└── README.md              # Project documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details
