# CityForge — Agent Guide

A community platform providing a business directory (with user submissions and
reviews), forums, classifieds (help-wanted posts), events, curated resources,
and full-text search. This is the Django rewrite of an older Next.js app;
legacy JSON exports can be imported with `manage.py import_prisma_export`.

## Project overview

Three deployable components live in one repo:

- **Django monolith** (`cityforge/` + `apps/*`): server-rendered web pages plus
  JSON APIs under `/api/*`, including a custom staff CMS mounted at `/manage/`
  (there is **no** `django.contrib.admin` site).
- **Mobile app** (`mobile/`): Expo / React Native + TypeScript client that talks
  to the `/api/*` endpoints using bearer tokens.
- **Indexer** (`indexer/`): standalone Python crawler that fetches business
  card websites and indexes them into OpenSearch. It shares the root Poetry
  environment (run it with `poetry run python indexer/indexer.py`).

## Technology stack

- **Web**: Django 6 (Python ^3.12), Django templates, Whitenoise static, Gunicorn WSGI
- **Database**: PostgreSQL (psycopg 3) via `dj-database-url`; sqlite fallback for dev
- **Cache**: Redis via django-redis (three cache aliases: `default`, `cards`, `search`;
  tests override them with LocMemCache)
- **Search**: OpenSearch 2.x via `opensearch-py`
- **API docs**: drf-spectacular (OpenAPI at `/api/schema/`, Swagger at `/api/docs/swagger/`)
- **Dependency management**: Poetry (`pyproject.toml` + `poetry.lock` at repo root)
- **Mobile**: Expo ~57, React Native 0.86, React 19, TypeScript, ESLint
- **Infra**: Docker Compose for local stack; Kubernetes manifests under `k8s/` (kustomize)

## Code organization

```
cityforge/     Django project package (settings, urls, wsgi/asgi)
apps/
  accounts/    Custom User (AUTH_USER_MODEL = accounts.User), auth, password reset,
               session web auth + bearer-token API auth
  directory/   Business cards, tags, reviews, submissions; web + /api/cards/* views
  forums/      Forum models
  classifieds/ Help-wanted posts/comments
  events/      Events + ICS feed + submissions
  resources/   Curated resources + OpenSearch indexing source
  webhooks/    Webhook endpoint/event/delivery models and dispatch
  indexing/    Indexer job tracking
  search/      OpenSearch query view (web search page)
  cms/         Custom staff/admin views (mounted at /manage/); decorators.py has
               staff_required / admin_required
  core/        Base utilities: logging, middleware, cache utils, DB monitoring,
               context processors, password validators, management commands
templates/     All HTML templates (accounts, cms, directory, emails, events, search)
static/        Site CSS / favicon
indexer/       Python crawler service (indexer.py, config.py, own Dockerfile)
mobile/        Expo React Native app (src/{api,components,contexts,hooks,navigation,screens,theme,types,utils})
k8s/           Kubernetes manifests + kustomization (deployment, cronjobs, postgres,
               opensearch, redis, nginx, backups)
tests/         Cross-app tests: tests/e2e/ (pytest marker `e2e`), test_indexer.py,
               test_k8s_manifests.py
reference/     Legacy material (old docs, schema.prisma) — excluded from lint/type checks
```

All URL wiring lives in the single root router `cityforge/urls.py`: public pages,
`/api/*` endpoints, OpenAPI docs, `/manage/` CMS, event feeds, and `/media/*` serving.

## Build and test commands

Backend (Poetry-managed; prefix commands with `poetry run`):

```bash
poetry install --with dev          # install dependencies (dev group included)
cp .env.example .env               # required: DJANGO_SECRET_KEY is mandatory
python manage.py migrate
python manage.py runserver
```

```bash
# Tests (pytest + pytest-django; coverage must stay >= 90%)
poetry run pytest                                          # full suite with coverage
poetry run pytest apps --ignore=tests/e2e --no-cov         # unit tests only
poetry run pytest tests/e2e -m e2e --no-cov                # end-to-end journeys
poetry run pytest apps/core/tests.py::ClassName::test_name # single test

# Lint / type check / security scan
poetry run ruff check .
poetry run ruff format --check .
poetry run mypy apps cityforge indexer tests
poetry run semgrep --config=p/python --config=p/django --config=p/security-audit \
  --config=p/dockerfile --error --skip-unknown-extensions \
  --exclude=reference --exclude=.venv --exclude=node_modules --exclude=staticfiles

# Django sanity checks (also run in CI)
poetry run python manage.py check
poetry run python manage.py makemigrations --check --dry-run
```

Pre-commit runs ruff, ruff-format, unit tests, mypy, semgrep, and mobile
lint/type-check/expo-doctor on commit; e2e tests run at pre-push:

```bash
poetry run pre-commit install
poetry run pre-commit run --all-files
```

Mobile app:

```bash
cd mobile && npm install
npm run lint            # eslint
npm run type-check      # tsc --noEmit
npm start               # expo start
```

Docker (full local stack: postgres, opensearch, gunicorn web on :8000, indexer worker):

```bash
docker compose up --build
```

The container entrypoint (`docker-entrypoint.sh`) runs `migrate`,
`sync_sequences`, `collectstatic`, and optionally creates a superuser when
`DJANGO_SUPERUSER_EMAIL`/`DJANGO_SUPERUSER_PASSWORD` are set, then starts gunicorn.

## Code style guidelines

- **Ruff** is the linter/formatter: line length 100, target Python 3.12, rule
  sets `E F W I UP B DJ`; `E501` and `DJ001` are ignored (legacy nullable string
  columns from the Prisma import). `migrations/`, `.venv`, and `reference/` are
  excluded from ruff and mypy.
- **Type annotations are mandatory in production code**: mypy enforces
  `disallow_untyped_defs` + `disallow_incomplete_defs` for `apps.*`,
  `cityforge.*`, and `indexer.*` (django-stubs plugin enabled). Test files are
  type-checked but not required to be fully annotated.
- Follow Django app conventions already in place: models/forms/views/urls per
  app, templates under `templates/<app>/`.
- Comments in the codebase are written in English; keep it that way.

## Testing instructions

- Framework: **pytest** with **pytest-django** (`DJANGO_SETTINGS_MODULE =
  cityforge.settings`), configured in `pyproject.toml`. Default `addopts` enable
  coverage over `apps` + `cityforge` and **fail below 90% coverage** — use
  `--no-cov` for quick local runs.
- Test discovery: `test_*.py`, `tests.py`, `*_tests.py`. Most apps keep tests in
  `apps/<app>/tests.py`; cross-cutting and e2e tests live under `tests/`.
- E2E tests are marked with the custom marker `e2e` (`pytestmark =
  pytest.mark.e2e`) and run with `pytest tests/e2e -m e2e --no-cov`.
- Tests never touch Redis: `cityforge/settings.py` swaps all caches to
  LocMemCache when `TESTING` is true, and the root `conftest.py` does the same
  under pytest.
- CI (`.github/workflows/ci.yml`) runs against real Postgres 17 and OpenSearch
  services: ruff check/format, mypy, `manage.py check`,
  `makemigrations --check --dry-run`, pytest, e2e, and semgrep. Keep migrations
  up to date — CI fails if `makemigrations --check` detects missing migrations.

## Project-specific conventions

- **Dual auth model**: web uses session auth (`apps/accounts/urls.py`); mobile
  uses custom bearer tokens on `/api/auth/*` (`apps/accounts/urls_api.py`,
  `apps/accounts/views.py` — custom token encode/decode and blacklist, not DRF
  tokens). CSRF is bypassed only for the mobile auth endpoints via
  `MobileApiCsrfBypassMiddleware` / `MobileBearerAuthMiddleware` in
  `apps/core/middleware.py`.
- **API routes accept both trailing-slash and non-trailing-slash variants** for
  mobile stability (see `apps/accounts/urls_api.py`, `apps/directory/urls_api.py`,
  and the duplicated patterns in `cityforge/urls.py`). Preserve both when
  adding API routes.
- **Directory API payload parsing accepts JSON and form-style input**, in both
  snake_case and camelCase, via `_request_payload` / `_form_payload` helpers in
  `apps/directory/views.py`.
- **No Django admin**: moderation/admin flows live in `apps/cms/*` at `/manage/`.
  Gate new CMS views with the `staff_required` / `admin_required` decorators in
  `apps/cms/decorators.py` rather than ad-hoc permission checks.
- **Domain mutations emit webhook events**: directory and CMS views call
  `apps.webhooks.service.dispatch_event(...)` with rich metadata (`change_text`,
  `content_url`, `source_info`). Emit matching events for new mutation flows.
- **Search has a fallback**: API search falls back to local DB resource search
  when OpenSearch is unavailable.
- **Passwords**: PBKDF2 is the primary hasher; `BCryptPasswordHasher` is kept to
  support legacy bcrypt hashes imported from the old Node app. Minimum password
  length is 12 plus a custom complexity validator
  (`apps/core/password_validators.py`).
- **Settings are env-driven** via django-environ; see `.env.example` for every
  supported variable. `DJANGO_SECRET_KEY` has no default — set it in `.env`
  before running anything.

## Security considerations

- When `DEBUG=False`, settings refuse to boot with an insecure/placeholder
  `DJANGO_SECRET_KEY` or wildcard/empty `ALLOWED_HOSTS`; secure cookies, HSTS,
  proxy SSL header, and `SECURE_SSL_REDIRECT` are enabled.
- Never commit `.env` or real secrets. `k8s/secrets.yaml.template` and
  `k8s/mailgun-email-secret.yaml.example` are templates — populate real values
  out of band.
- Semgrep (`p/python`, `p/django`, `p/security-audit`, `p/dockerfile` rule
  packs) runs in pre-commit and CI; the Docker workflow also runs a Trivy scan
  that fails on HIGH/CRITICAL vulnerabilities.
- The `indexer/` crawler validates URLs and respects robots.txt; keep SSRF
  protections (private-IP checks in `indexer/indexer.py`) intact when modifying
  it.
- The `/media/` view in `apps/core/views.py` refuses to serve files when
  `DEBUG=False` — production media is served by the nginx sidecar from the PVC.
- `TODO.md` tracks known hardening work (k8s `readOnlyRootFilesystem`,
  NetworkPolicies, image digest pinning, OpenSearch credential handling) —
  consult it before changing `k8s/` manifests.

## Deployment

- **Docker image**: multi-stage `Dockerfile` (python:3.12-alpine, Poetry-built
  venv copied into a non-root runtime image). Version is read from
  `pyproject.toml`; pushing to `main` with a `pyproject.toml` change triggers
  the release workflow (tagged releases), and the docker workflow publishes
  images to GHCR.
- **Kubernetes**: manifests under `k8s/` deployed with `kubectl apply -k k8s/`
  (requires the Zalando postgres operator; see `k8s/README.md`). Includes
  CronJobs for the indexer, DB backups, and admin digests; postgres, opensearch,
  redis, nginx ingress/config, and an uploads PVC.
- **Mobile**: Expo/EAS build profiles in `mobile/eas.json` (see
  `mobile/DEPLOYMENT.md`).
