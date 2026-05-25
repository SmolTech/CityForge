# Copilot Instructions for CityForge

## Build, test, and lint commands

### Backend (Django/Poetry)

```bash
poetry install --with dev
poetry run python manage.py check
poetry run python manage.py makemigrations --check --dry-run
poetry run python manage.py migrate --noinput
poetry run pytest
poetry run pytest tests/e2e -m e2e --no-cov
```

Run a single backend test:

```bash
poetry run pytest apps/core/tests.py::DatabaseMonitoringTests::test_health_endpoint_includes_database_metrics
```

Lint/security checks used in CI and pre-commit:

```bash
poetry run ruff check .
poetry run ruff format --check .
poetry run semgrep --config=p/python --config=p/django --config=p/security-audit --config=p/dockerfile --error --skip-unknown-extensions --exclude=reference --exclude=.venv --exclude=node_modules --exclude=staticfiles
poetry run pre-commit run --all-files
```

### Mobile app (`mobile/`)

```bash
cd mobile && npm install
cd mobile && npm run lint
cd mobile && npm run type-check
cd mobile && npm start
```

Run lint for a single mobile file:

```bash
cd mobile && npm run lint -- src/screens/HomeScreen.tsx
```

### Container build/dev stack

```bash
docker compose up --build
docker build -f Dockerfile .
```

### Indexer

```bash
poetry run python indexer/indexer.py
```

## High-level architecture

- **Django monolith + separate mobile app + crawler/indexer**: Server-rendered web and JSON APIs live in one Django project (`cityforge/` + `apps/*`), mobile client is in `mobile/`, and the standalone crawler in `indexer/` feeds OpenSearch.
- **Single root router with mixed surfaces** (`cityforge/urls.py`): public web pages, `/api/*` endpoints, OpenAPI docs, `/manage/` custom staff CMS, event calendar routes, and `/media/*` file serving are all wired from one place.
- **Dual auth model**: web uses session auth (`apps/accounts/urls.py`), while mobile uses bearer tokens on `/api/auth/*` (`apps/accounts/urls_api.py`, `apps/accounts/views.py`). CSRF is explicitly bypassed only for those mobile auth endpoints (`apps/core/middleware.py`).
- **Search split across web + API + OpenSearch fallback**: web search (`apps/search/views.py`) and mobile-facing search (`apps/directory/views.py:api_opensearch`) share OpenSearch query behavior; API search falls back to local DB resource search when OpenSearch is unavailable.
- **Operational event pipeline**: directory and CMS mutations dispatch structured events through `apps.webhooks.service.dispatch_event`, persisted in webhook event/delivery models and delivered to configured endpoints (including Mattermost format).
- **No Django admin site**: operational moderation/admin flows are implemented in `apps/cms/*` and mounted at `/manage/` rather than using `django.contrib.admin`.

## Key conventions in this repository

- **API routes intentionally accept both trailing and non-trailing slash variants** for mobile stability (e.g., `apps/accounts/urls_api.py`, `apps/directory/urls_api.py`).
- **Mobile auth is custom bearer-token based**, not DRF token/session auth defaults (`apps/accounts/views.py` token encode/decode, blacklist, and `/api/auth/*` endpoints).
- **Directory API payload parsing accepts both JSON and form-style input**, with support for both snake_case and camelCase field names via `_request_payload` and `_form_payload` helpers (`apps/directory/views.py`).
- **Domain changes should emit webhook events with rich metadata** (`change_text`, `content_url`, `source_info`) as seen in directory and CMS views calling `dispatch_event(...)`.
- **Role-gated CMS access uses decorators** (`staff_required`, `admin_required`) rather than ad-hoc checks; follow this pattern for new CMS views (`apps/cms/decorators.py`, `apps/cms/views.py`).

## MCP server setup for browser workflows

- Use the repository MCP config at `.vscode/mcp.json` to enable Playwright MCP (`@playwright/mcp`) for web flow exploration and UI validation.
- In Copilot CLI, the equivalent server can be added with `/mcp add` using:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "local",
      "command": "npx",
      "tools": [
        "*"
      ],
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```
