# CityForge

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Code Quality**: ESLint + Prettier + Semgrep with git hooks
- **Security**: Semgrep static analysis for vulnerability detection
- **Containerization**: Docker with multi-stage builds
- **Deployment**: Kubernetes manifests included
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

## Security Analysis

The project includes Semgrep for automated security vulnerability detection:

```bash
# Run security analysis
npm run semgrep

# Run security analysis (CI mode - quiet output)
npm run semgrep:ci
```

## Git Hooks

This project includes git hooks for code quality and security:

- **Pre-commit**: Runs lint-staged (ESLint + Prettier) and semgrep security analysis
- **Pre-push**: Runs type checking, linting, semgrep, and build verification

## Project Structure

```
├── src/
│   └── app/
│       ├── business/      # Business directory pages
│       ├── calendar/      # Community calendar pages
│       ├── news/          # News section pages
│       ├── op-ed/         # Opinion & editorial pages
│       └── page.tsx       # Homepage
├── k8s/                   # Kubernetes manifests
├── .husky/                # Git hooks
├── Dockerfile             # Container configuration
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
