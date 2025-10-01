FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN apt-get update && apt-get install -y curl && apt-get clean
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user with specific UID/GID to match Kubernetes security context
RUN groupadd -r appuser --gid 1001 && useradd -r -g appuser --uid 1001 appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "wsgi:app"]
