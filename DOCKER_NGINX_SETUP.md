# Docker Compose with Nginx Reverse Proxy

This document describes the nginx reverse proxy setup in the Docker Compose environment.

## Overview

An nginx reverse proxy has been added to the Docker Compose setup that mirrors the routing behavior of the Kubernetes ingress controller. This provides a consistent development environment that matches production.

## Architecture

```
External Request (port 80)
        ↓
    nginx (port 80)
        ↓
    ┌───┴───────────────────────┐
    ↓                           ↓
frontend (port 3000)    backend (port 5000)
```

## Routing Rules

The nginx proxy implements the same routing as the Kubernetes ingress:

1. **`/api/config`** → Frontend (Next.js API route)
   - Must be checked first to avoid being caught by the `/api` rule
2. **`/api/*`** → Backend (Flask API)
   - All API endpoints except `/api/config`
3. **`/*`** → Frontend (Next.js)
   - All other routes (pages, static files, etc.)

## Configuration Files

- **`nginx.conf`**: Nginx configuration with routing rules
- **`docker-compose.yml`**: Updated with nginx service and internal networking

## Changes Made

1. **Added nginx service** to docker-compose.yml
   - Uses official `nginx:alpine` image
   - Exposes port 80 to host
   - Mounts nginx.conf as read-only
   - Has health check endpoint at `/nginx-health`

2. **Updated service networking**
   - Backend: Changed from `ports` to `expose` (5000)
   - Frontend: Changed from `ports` to `expose` (3000)
   - Only nginx exposes port 80 to the host

3. **Created nginx.conf**
   - Upstream definitions for frontend and backend
   - Route matching Kubernetes ingress rules
   - WebSocket support for Next.js hot reload
   - CORS headers for API requests
   - Gzip compression enabled

## Usage

### Starting the services

```bash
docker-compose up --build
```

### Accessing the application

- **Web Interface**: http://localhost
- **API Endpoints**: http://localhost/api/\*
- **Next.js API Routes**: http://localhost/api/config

### Health Checks

- Frontend health: http://localhost/ (should load the app)
- Backend health: http://localhost/api/health
- Nginx health: http://localhost/nginx-health

### Logs

View nginx logs:

```bash
docker logs cityforge-nginx
```

## Development Notes

- The nginx proxy forwards all WebSocket connections for Next.js hot module replacement
- File uploads are handled through the `/api/upload` endpoint and proxied to the backend
- The backend container name changed from `cityforge-backend` to `backend` in internal references
- CORS is configured in nginx for API requests

## Troubleshooting

### Services not accessible

```bash
# Check if all services are running
docker-compose ps

# Check nginx logs
docker logs cityforge-nginx

# Verify nginx config
docker exec cityforge-nginx nginx -t
```

### Port 80 already in use

Stop the conflicting service or change the port in docker-compose.yml:

```yaml
nginx:
  ports:
    - "8080:80" # Use port 8080 instead
```

### Hot reload not working

Ensure WebSocket connections are working:

```bash
# Check nginx logs for WebSocket upgrade requests
docker logs -f cityforge-nginx
```
