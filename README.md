# CityForge

A community platform built with **Django 5** and Django templates. Provides a
business directory with user submissions and reviews, OpenSearch-powered
resource search, and a custom staff CMS (no `django.contrib.admin`).

> This is the Django rewrite of the original Next.js application. The legacy
> JSON exports produced by the old `/api/admin/data/export` endpoint can be
> imported with the `import_prisma_export` management command.

## Stack

- **Web**: Django 5 + Django templates (server-rendered)
- **Database**: PostgreSQL (sqlite fallback for dev) via `dj-database-url`
- **Search**: OpenSearch 2.x via `opensearch-py`
- **Static**: Whitenoise
- **WSGI**: Gunicorn

## Project layout

```
cityforge/     Django project (settings, urls, wsgi/asgi)
apps/
  accounts/    Custom User, auth, password reset
  directory/   Business cards, tags, reviews, submissions
  forums/      Forum models
  classifieds/ Help-wanted posts/comments
  resources/   Curated resources + OpenSearch indexing source
  webhooks/    Webhook endpoint/event/delivery
  indexing/    Indexer job tracking
  search/      OpenSearch query view
  cms/         Custom staff/admin views (mounted at /manage/)
  core/        Base utilities, context processors, mgmt commands
templates/     All HTML templates
static/        Site CSS / JS
indexer/       Python crawler service (unchanged from upstream)
```

## Quickstart (local)

```bash
pipx install poetry           # or: pip install --user poetry
poetry install --with dev
cp .env.example .env          # edit as needed

poetry run python manage.py migrate
poetry run python manage.py createsuperuser
poetry run python manage.py runserver
```

### Pre-commit hooks

```bash
poetry run pre-commit install
poetry run pre-commit run --all-files
```

The hook config runs `ruff`, `ruff-format`, and `semgrep` (with the `p/python`,
`p/django`, and `p/security-audit` rule packs) on every commit.

Visit:

- `/` — public business directory
- `/search/` — OpenSearch search
- `/accounts/login/`, `/accounts/register/`
- `/manage/` — staff CMS (requires `is_staff` or role `admin`/`support`)

## Docker

```bash
docker compose up --build
```

This brings up `postgres`, `opensearch`, the Django `web` service (gunicorn on
port 8000), and the `indexer` worker. The entrypoint runs migrations,
collectstatic, and optionally creates a superuser from
`DJANGO_SUPERUSER_EMAIL`/`DJANGO_SUPERUSER_PASSWORD`.
Uploaded business submission images are stored under `MEDIA_ROOT` (`/app/uploads`
in Compose) and persisted by the `web_uploads` volume.

The compose defaults are for local development. For any shared or production-like
deployment, set a unique `DJANGO_SECRET_KEY`, explicit `DJANGO_ALLOWED_HOSTS`,
and a strong `DJANGO_SUPERUSER_PASSWORD` via `.env`.

## Importing legacy data

```bash
python manage.py import_prisma_export path/to/export.json
# Optional: --dry-run, --only User,Card,Tag
```

Legacy bcrypt passwords are preserved when the export includes a password hash
(including nested user payloads). Users without a legacy hash get an unusable
password and must use the password-reset flow.

## Environment variables

See `.env.example`. Key variables:

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Required in production |
| `DJANGO_DEBUG` | `True`/`False` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated host list |
| `DATABASE_URL` | Postgres DSN; falls back to sqlite |
| `OPENSEARCH_HOST` / `_PORT` / `_NAMESPACE` | OpenSearch connection |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` for dev |
| `SITE_NAME`, `SITE_TAGLINE` | Branding shown in templates |

## License

See `LICENSE`.
