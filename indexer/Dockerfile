FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN groupadd -r appuser --gid 1001 && useradd -r -g appuser --uid 1001 appuser
RUN chown -R appuser:appuser /app

USER appuser

CMD ["python", "indexer.py"]