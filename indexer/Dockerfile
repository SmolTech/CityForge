FROM python:3.12-alpine AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VERSION=2.1.1 \
    POETRY_NO_INTERACTION=1

WORKDIR /app

RUN apk add --no-cache gcc musl-dev libffi-dev postgresql-dev \
    && pip install "poetry==${POETRY_VERSION}"

COPY pyproject.toml poetry.lock* /app/
RUN poetry config virtualenvs.in-project true \
    && poetry install --only main --no-root --no-ansi


FROM python:3.12-alpine AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY indexer/ /app/

# Remove build-only tooling from the runtime venv and any stray caches.
RUN /app/.venv/bin/pip uninstall -y pip setuptools wheel >/dev/null 2>&1 || true \
    && find /app -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true \
    && find /app -type f -name '*.pyc' -delete \
    && addgroup -S -g 1001 appuser \
    && adduser -S -u 1001 -G appuser -h /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app

USER appuser

CMD ["python", "indexer.py"]
