# Security Headers Implementation

## Overview

CityForge implements a comprehensive security headers system to protect against common web vulnerabilities including XSS, clickjacking, MITM attacks, and data leakage. The implementation uses a multi-layer approach with both Next.js middleware and nginx configuration to ensure security headers are applied consistently across all environments.

## Architecture

### Multi-Layer Security Headers

The security headers are implemented at two levels:

1. **Next.js Middleware** (`src/middleware.ts`) - Primary security headers applied to all responses
2. **nginx Configuration** (`nginx.conf`) - Backup security headers for production deployments

This dual approach ensures security headers are present even if one layer fails or is misconfigured.

### Environment-Based Configuration

Security headers adapt automatically based on the deployment environment:

- **Development**: Relaxed CSP to support hot reload, debugging tools
- **Production**: Strict CSP with minimal allowed sources for maximum security

## Security Headers Implemented

### Content Security Policy (CSP)

**Purpose**: Prevents XSS attacks by controlling resource loading sources.

**Development Configuration**:

```
default-src 'self';
script-src 'self' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' https: data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

**Production Configuration**:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' https: data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

**Key Differences**:

- `'unsafe-eval'` removed in production (blocks eval() and related functions)
- `'unsafe-inline'` retained for styles (required by Tailwind CSS)

### HTTP Strict Transport Security (HSTS)

**Purpose**: Prevents MITM attacks by forcing HTTPS connections.

**Configuration**:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Features**:

- 1-year cache duration (`max-age=31536000`)
- Applies to all subdomains (`includeSubDomains`)
- Eligible for browser preload lists (`preload`)

### X-Frame-Options

**Purpose**: Prevents clickjacking attacks by controlling iframe embedding.

**Configuration**:

```
X-Frame-Options: DENY
```

**Effect**: Completely blocks the site from being embedded in iframes.

### X-Content-Type-Options

**Purpose**: Prevents MIME type sniffing attacks.

**Configuration**:

```
X-Content-Type-Options: nosniff
```

**Effect**: Forces browsers to respect declared Content-Type headers.

### Referrer-Policy

**Purpose**: Controls referrer information sent with requests.

**Configuration**:

```
Referrer-Policy: strict-origin-when-cross-origin
```

**Effect**:

- Same-origin requests: Send full referrer
- Cross-origin HTTPS→HTTPS: Send origin only
- Cross-origin HTTPS→HTTP: Send no referrer

### Permissions-Policy

**Purpose**: Controls browser feature access.

**Configuration**:

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

**Effect**: Disables camera, microphone, geolocation, and payment features.

## Implementation Details

### Security Headers Utility

**Location**: `src/lib/security-headers.ts`

**Key Functions**:

- `getSecurityHeaders()` - Returns complete security headers object
- `getCSPHeader()` - Generates environment-specific CSP
- `isProduction()` - Detects production environment

**Environment Detection**:

```typescript
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
```

**Usage Example**:

```typescript
import { getSecurityHeaders } from "@/lib/security-headers";

const headers = getSecurityHeaders();
// Apply to response
```

### Next.js Middleware Integration

**Location**: `src/middleware.ts`

**Implementation**:

```typescript
import { getSecurityHeaders } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
```

**Matcher Configuration**:

- Applies to all routes except API routes, static files, and favicon
- Ensures security headers are applied to user-facing pages

### nginx Configuration

**Location**: `nginx.conf`

**Security Headers Block**:

```nginx
# Security Headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

# HSTS (only for HTTPS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# CSP (production-ready)
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
```

**Key Points**:

- Uses `always` directive to apply headers even on error responses
- Production-ready CSP configuration (no `'unsafe-eval'`)
- HSTS configured for maximum security

## Testing and Validation

### Automated Testing

**Test Suite**: `tests/utils/security-headers.test.ts`

**Coverage**: 23 comprehensive tests covering:

- Basic header generation
- Environment-specific CSP policies
- Production/development differences
- Environment variable handling
- Error handling and graceful fallbacks

**Run Tests**:

```bash
npm test tests/utils/security-headers.test.ts
```

### CLI Testing Tool

**Location**: `scripts/test-security-headers.sh`

**Usage**:

```bash
# Test local development
./scripts/test-security-headers.sh http://localhost:3000

# Test production deployment
./scripts/test-security-headers.sh https://yourdomain.com

# Test with custom path
./scripts/test-security-headers.sh https://yourdomain.com /api/cards
```

**Features**:

- Tests all implemented security headers
- Validates CSP policy syntax
- Provides detailed pass/fail reports
- Supports custom URLs and paths

### Programmatic Validator

**Location**: `scripts/security-headers-validator.ts`

**Usage**:

```bash
npx tsx scripts/security-headers-validator.ts https://yourdomain.com
```

**Features**:

- TypeScript-based validation
- Detailed header analysis
- Programmatic integration support
- JSON output option for CI/CD

## Environment Configuration

### Environment Variables

**CSP Configuration**:

- `NODE_ENV=production` - Enables strict production CSP
- `NODE_ENV=development` - Enables relaxed development CSP

**Custom CSP Sources** (optional):

```bash
# Add custom script sources
CSP_SCRIPT_SRC_EXTRA="https://trusted-cdn.com"

# Add custom style sources
CSP_STYLE_SRC_EXTRA="https://fonts.googleapis.com"

# Add custom connect sources
CSP_CONNECT_SRC_EXTRA="https://api.example.com"
```

### Development vs Production

**Development Environment**:

- Includes `'unsafe-eval'` in script-src for hot reload
- Relaxed CSP for development tools
- Additional debugging allowances

**Production Environment**:

- Strict CSP with minimal allowed sources
- No `'unsafe-eval'` to prevent code injection
- Maximum security configuration

## Deployment Considerations

### Docker Deployments

**Dockerfile Security**:

- nginx configuration includes security headers
- Next.js middleware provides backup headers
- Multi-layer approach ensures coverage

**Environment Handling**:

```dockerfile
ENV NODE_ENV=production
```

### Kubernetes Deployments

**ConfigMap Configuration**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-config
data:
  NODE_ENV: "production"
  CSP_EXTRA_SOURCES: "https://trusted-external.com"
```

**Ingress Security**:

- Configure HTTPS termination
- Enable HSTS at ingress level
- Additional security headers via ingress annotations

### CDN Integration

**CloudFlare/CloudFront**:

- Security headers work with CDN caching
- Configure CDN to respect origin headers
- Consider additional CDN security features

## Troubleshooting

### Common Issues

**1. CSP Violations in Development**

**Symptom**: Console errors about blocked resources
**Solution**: Check if using `NODE_ENV=development` for relaxed CSP

**2. Styles Not Loading**

**Symptom**: Unstyled content, CSP style-src violations
**Solution**: Ensure `'unsafe-inline'` is included in style-src (required for Tailwind)

**3. HSTS Issues in Development**

**Symptom**: Cannot access HTTP localhost
**Solution**: HSTS is only applied in production; clear browser HSTS cache if needed

**4. Double Headers in nginx + Next.js**

**Symptom**: Duplicate security headers
**Solution**: This is expected and safe; multiple layers provide redundancy

### Testing Checklist

**Before Production Deployment**:

1. ✅ Run automated test suite
2. ✅ Test with CLI validation tool
3. ✅ Verify CSP doesn't break functionality
4. ✅ Check HSTS configuration
5. ✅ Test with browser security tools
6. ✅ Validate with security scanners

**Security Scanner Integration**:

- Mozilla Observatory: https://observatory.mozilla.org/
- Security Headers: https://securityheaders.com/
- SSL Labs: https://www.ssllabs.com/ssltest/

### Performance Impact

**Minimal Overhead**:

- Headers add ~500-800 bytes per response
- CSP parsing is done by browser, not server
- nginx performance impact: negligible
- Next.js middleware impact: microseconds

**Optimization**:

- Headers are static and cacheable
- No database queries or external calls
- Efficient string operations only

## Security Benefits

### Attack Vectors Mitigated

**Cross-Site Scripting (XSS)**:

- CSP blocks inline scripts and untrusted sources
- X-Content-Type-Options prevents MIME sniffing

**Clickjacking**:

- X-Frame-Options prevents iframe embedding
- CSP frame-ancestors provides additional protection

**Man-in-the-Middle (MITM)**:

- HSTS forces HTTPS connections
- Preload list inclusion for maximum protection

**Information Disclosure**:

- Referrer-Policy controls referrer leakage
- Permissions-Policy disables unnecessary browser features

### Compliance Benefits

**Industry Standards**:

- OWASP recommendations compliance
- Security best practices implementation
- Audit-ready configuration

**Framework Compatibility**:

- Next.js 15 compatible
- React/Tailwind CSS compatible
- Modern browser support

## Maintenance

### Regular Tasks

**Monthly**:

- Review CSP violation reports
- Update dependency security
- Test security headers in staging

**Quarterly**:

- Security scanner audits
- Update CSP sources if needed
- Review and update documentation

**Annual**:

- Full security review
- Penetration testing
- Security training updates

### Version Updates

**Next.js Updates**:

- Test security headers after framework updates
- Verify middleware compatibility
- Update CSP if new requirements

**Browser Compatibility**:

- Monitor new CSP features
- Update headers for new security standards
- Test with latest browser versions

## Additional Resources

### Security References

- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [HSTS RFC 6797](https://tools.ietf.org/html/rfc6797)

### Testing Tools

- [CSP Validator](https://csp-validator.org/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers Scanner](https://securityheaders.com/)

### Next.js Security

- [Next.js Security Guide](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [React Security Best Practices](https://blog.sqreen.com/security-best-practices-react/)

---

_This documentation covers the complete security headers implementation for CityForge. For questions or issues, refer to the troubleshooting section or consult the security team._
