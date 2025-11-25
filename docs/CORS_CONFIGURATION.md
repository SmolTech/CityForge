# CORS Configuration Guide

This guide explains how Cross-Origin Resource Sharing (CORS) is configured for the CityForge application.

## Overview

CityForge implements a multi-layer CORS configuration to ensure secure cross-origin API access while supporting both web and mobile clients:

1. **nginx Proxy Layer** - Primary CORS handling for production deployments
2. **Next.js Middleware** - Fallback CORS handling for development and direct access
3. **Environment-based Configuration** - Flexible origin management across environments

## Configuration Layers

### 1. nginx Proxy CORS (Production)

The nginx reverse proxy (`nginx.conf`) handles CORS for production deployments:

**Features:**

- Origin validation using regex patterns
- Support for subdomains
- Proper preflight request handling
- Credentials support for cookie authentication

**Allowed Origins:**

- `localhost:*` (development)
- `127.0.0.1:*` (local testing)
- `*.community.community` (production domain)
- `*.cityforge.cityforge` (alternative domain)

### 2. Next.js Middleware CORS (Development)

The Next.js middleware (`src/middleware.ts`) provides CORS handling when nginx is not available:

**Features:**

- Automatic preflight handling
- Dynamic origin validation
- Seamless integration with API routes
- Development-friendly defaults

## Environment Configuration

### Development (.env.local)

```bash
# Local development origins
CORS_ALLOWED_ORIGINS=localhost:3000,127.0.0.1:3000
```

### Production (docker-compose.yml)

```yaml
environment:
  CORS_ALLOWED_ORIGINS: "localhost:3000,127.0.0.1:3000,community.community,cityforge.cityforge"
```

### Kubernetes (k8s/config.yaml)

```yaml
data:
  CORS_ALLOWED_ORIGINS: "community.community,www.community.community,cityforge.cityforge,www.cityforge.cityforge"
```

## Security Features

### Origin Validation

1. **Exact Domain Matching**: `https://community.community`
2. **Subdomain Support**: `https://app.community.community`
3. **Development Localhost**: `http://localhost:3000`
4. **Local IP Access**: `http://127.0.0.1:3000`

### Headers Configuration

- **Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- **Headers**: `Authorization, Content-Type, X-Requested-With`
- **Credentials**: `true` (supports cookie authentication)
- **Max Age**: `86400` seconds (24 hours)

### Blocked Origins

All origins not explicitly allowed are automatically blocked:

- No CORS headers are sent for unauthorized origins
- Preflight requests return without access-control headers
- API requests from blocked origins will fail in browsers

## Mobile App Support

The CORS configuration supports mobile app API access:

- Mobile apps don't need CORS (same-origin policy doesn't apply)
- API endpoints work directly with Authorization headers
- CORS headers are sent but ignored by mobile HTTP clients

## Testing

Use the provided test script to verify CORS configuration:

```bash
# Test local development server
./scripts/test-cors.sh http://localhost:3000

# Test production deployment
./scripts/test-cors.sh https://your-domain.com
```

## Troubleshooting

### Common Issues

**Issue**: API requests fail with CORS errors
**Solution**: Verify origin is in `CORS_ALLOWED_ORIGINS` environment variable

**Issue**: Mobile app can't access API
**Solution**: Mobile apps don't need CORS - check authentication headers instead

**Issue**: Subdomains are blocked
**Solution**: CORS automatically allows subdomains of configured domains

### Debug Steps

1. **Check nginx logs**: `docker logs cityforge-nginx`
2. **Verify environment variables**: Check `CORS_ALLOWED_ORIGINS`
3. **Test with curl**: Use test script to verify specific origins
4. **Browser DevTools**: Check Network tab for CORS errors

## Deployment Notes

### Docker Compose

CORS origins are configured via environment variables in `docker-compose.yml`. Update the `CORS_ALLOWED_ORIGINS` value for your domains.

### Kubernetes

CORS configuration is managed in `k8s/config.yaml`. Update the ConfigMap and restart pods to apply changes.

### nginx Configuration

For custom nginx deployments, modify the origin validation patterns in the `/api` location block.

## Security Best Practices

1. **Principle of Least Privilege**: Only allow necessary origins
2. **Use HTTPS**: Always use secure protocols in production
3. **Regular Audits**: Review allowed origins periodically
4. **Environment Separation**: Use different origins for dev/staging/prod
5. **Monitor Access**: Log and monitor cross-origin requests

## API Route Integration

Individual API routes can override CORS settings using the `withCORS` wrapper:

```typescript
import { withCORS } from "@/lib/cors";

export const GET = withCORS(
  async (request: NextRequest) => {
    // Your API logic here
    return NextResponse.json({ data: "response" });
  },
  {
    // Custom CORS options for this route
    allowedOrigins: ["https://special-client.com"],
  }
);
```

This provides fine-grained control for specific endpoints that need different CORS policies.
