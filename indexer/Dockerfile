FROM python:3.11-alpine

WORKDIR /app

# Install build dependencies for Python packages
RUN apk add --no-cache gcc musl-dev libffi-dev libxml2-dev libxslt-dev postgresql-dev

# Copy indexer requirements and install dependencies
COPY indexer/requirements.txt .
RUN pip install --upgrade pip==25.3 && \
    pip install --no-cache-dir -r requirements.txt

# Clean up build dependencies to reduce image size
RUN apk del gcc musl-dev libffi-dev

# Copy indexer code
COPY indexer/ .

# Create non-root user (Alpine style)
RUN addgroup -g 1001 appuser && adduser -u 1001 -G appuser -s /bin/sh -D appuser
RUN chown -R appuser:appuser /app

USER appuser

CMD ["python", "indexer.py"]
