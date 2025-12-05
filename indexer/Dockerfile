FROM python:3.11-slim-bookworm

WORKDIR /app

# Install build dependencies for Python packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libxml2-dev \
    libxslt1-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy indexer requirements and install dependencies with upgraded pip
COPY indexer/requirements.txt .
RUN pip install --upgrade pip==25.3 && \
    pip install --no-cache-dir -r requirements.txt

# Copy indexer code
COPY indexer/ .

# Create non-root user (Debian style)
RUN groupadd -r appuser && useradd --no-log-init -r -g appuser appuser
RUN chown -R appuser:appuser /app

USER appuser

CMD ["python", "indexer.py"]

CMD ["python", "indexer.py"]
