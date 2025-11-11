FROM python:3.11-slim

WORKDIR /app

# Copy indexer requirements and install dependencies
COPY indexer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy indexer code
COPY indexer/ .

# Create non-root user
RUN groupadd -r appuser --gid 1001 && useradd -r -g appuser --uid 1001 appuser
RUN chown -R appuser:appuser /app

USER appuser

CMD ["python", "indexer.py"]
