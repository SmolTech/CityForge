# Security Guidelines for CityForge

This document outlines security best practices and guidelines for the CityForge platform to prevent common security vulnerabilities and maintain a secure codebase.

## Table of Contents

1. [Error Handling & Logging](#error-handling--logging)
2. [Debug & Test Endpoints](#debug--test-endpoints)
3. [Authentication & Authorization](#authentication--authorization)
4. [Input Validation & Sanitization](#input-validation--sanitization)
5. [Environment-Specific Configurations](#environment-specific-configurations)
6. [Code Review Checklist](#code-review-checklist)

## Error Handling & Logging

### ❌ Don't: Expose Stack Traces in Production

```typescript
// BAD: Exposes internal implementation details
catch (error) {
  console.error("Error:", error); // Logs full error object including stack trace
  return NextResponse.json({
    error: error.message,
    stack: error.stack  // Never expose stack traces in production
  });
}
```

### ✅ Do: Use Environment-Gated Error Logging

```typescript
// GOOD: Environment-aware error handling
catch (error) {
  console.error("Error occurred:", error instanceof Error ? error.message : "Unknown error");

  // Only log detailed information in development
  if (process.env.NODE_ENV === "development") {
    console.error("Error details:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
  }

  return NextResponse.json({
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? error?.message : undefined,
  }, { status: 500 });
}
```

### Logging Best Practices

1. **Use the Logger Utility**: Always use the centralized logger (`src/lib/logger.ts` for frontend, `mobile/src/utils/logger.ts` for mobile) instead of direct `console.*` calls
2. **Redact Sensitive Data**: Use redaction utilities (`src/lib/utils/log-redaction.ts`) for URLs, tokens, and credentials
3. **Environment-Aware Logging**: Log levels should be appropriate for the environment (debug in dev, warn+ in production)
4. **Structured Logging**: Use consistent log formats with appropriate context

```typescript
// Frontend logging
import { logger } from "@/lib/logger";

logger.error("API request failed:", {
  endpoint: "/api/cards",
  error: error.message,
});

// Mobile logging
import { logger } from "@/utils/logger";

logger.error("Authentication failed:", { reason: "invalid_token" });
```

## Debug & Test Endpoints

### ❌ Don't: Expose Debug Endpoints in Production

```typescript
// BAD: Always accessible debug endpoint
export async function GET() {
  return NextResponse.json({
    env: process.env, // Exposes all environment variables!
    database: await getDatabaseInfo(),
  });
}
```

### ✅ Do: Environment-Gate Debug Endpoints

```typescript
// GOOD: Production-safe debug endpoint
export async function GET() {
  // Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Safe debug information only
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    // Never include sensitive environment variables
  });
}
```

### Debug Endpoint Checklist

- [ ] Environment check prevents production access
- [ ] No sensitive environment variables exposed
- [ ] No database credentials or connection strings exposed
- [ ] No internal system information that could aid attackers
- [ ] Clear purpose and documented removal plan

## Authentication & Authorization

### JWT Token Security

1. **httpOnly Cookies for Web**: Use `httpOnly` cookies to prevent XSS token theft
2. **Secure Headers for Mobile**: Use Authorization headers with secure token storage
3. **Token Blacklisting**: Implement database-backed token blacklisting for secure logout
4. **Environment-Appropriate Settings**: Use HTTPS-only cookies in production

```typescript
// Web authentication configuration
app.config["JWT_COOKIE_HTTPONLY"] = true; // Prevents JavaScript access
app.config["JWT_COOKIE_SECURE"] = isProduction; // HTTPS only in production
app.config["JWT_COOKIE_SAMESITE"] = "Lax"; // CSRF protection
```

### Authorization Patterns

```typescript
// Check authentication status
const user = await getCurrentUser(request);
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Check admin role
if (user.role !== "admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

## Input Validation & Sanitization

### API Input Validation

1. **Validate All Inputs**: Never trust client-provided data
2. **Use Schema Validation**: Implement Zod or similar for type-safe validation
3. **Sanitize HTML**: Escape user content that will be displayed
4. **Rate Limiting**: Implement appropriate rate limits for different endpoint types

```typescript
import { z } from "zod";

const CreateCardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  website_url: z.string().url().optional(),
  phone_number: z.string().max(20).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateCardSchema.parse(body);

    // Process validated data...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      );
    }
    // Handle other errors...
  }
}
```

## Environment-Specific Configurations

### Environment Variables

1. **Use Environment-Specific Defaults**: Different configurations for dev/staging/production
2. **Validate Required Variables**: Fail fast if critical configuration is missing
3. **Redact Sensitive Values**: Never log credentials or secrets

```typescript
// Environment configuration
const config = {
  development: {
    logLevel: "debug",
    corsOrigins: ["http://localhost:3000"],
    rateLimitStrict: false,
  },
  production: {
    logLevel: "warn",
    corsOrigins: [process.env.FRONTEND_URL],
    rateLimitStrict: true,
  },
};

const currentConfig =
  config[process.env.NODE_ENV as keyof typeof config] || config.development;
```

### Production Safety Checklist

- [ ] Debug endpoints are disabled
- [ ] Error messages don't expose internal details
- [ ] Logging is appropriate for the environment
- [ ] HTTPS is enforced for authentication
- [ ] CORS origins are restricted to known domains
- [ ] Rate limiting is enabled and configured appropriately

## Code Review Checklist

### Security Review Points

**Error Handling:**

- [ ] No stack traces exposed in production responses
- [ ] Console logging is environment-appropriate
- [ ] Error messages don't reveal sensitive information
- [ ] Proper HTTP status codes are used

**Authentication/Authorization:**

- [ ] Protected endpoints verify authentication
- [ ] Role-based access control is properly implemented
- [ ] JWT tokens are handled securely
- [ ] Session management follows best practices

**Input/Output:**

- [ ] All user inputs are validated and sanitized
- [ ] SQL injection prevention via parameterized queries
- [ ] XSS prevention via proper escaping
- [ ] File upload restrictions are in place

**Environment:**

- [ ] Debug/test endpoints are production-safe
- [ ] Environment variables don't contain secrets in code
- [ ] Production configurations are secure by default
- [ ] CORS and security headers are properly configured

**Dependencies:**

- [ ] Dependencies are up to date and from trusted sources
- [ ] Vulnerability scanning is performed regularly
- [ ] Third-party services are configured securely

## Common Vulnerability Patterns to Avoid

### 1. Information Disclosure

- Exposing environment variables in debug endpoints
- Logging sensitive data (passwords, tokens, API keys)
- Returning stack traces or internal errors to clients

### 2. Authentication Bypass

- Missing authentication checks on protected endpoints
- Inconsistent token validation
- Improper role-based access control

### 3. Injection Attacks

- SQL injection via dynamic query construction
- Command injection in file processing
- XSS via unsanitized user content

### 4. Configuration Issues

- Debug features enabled in production
- Weak CORS policies
- Insufficient rate limiting

## Incident Response

If a security issue is discovered:

1. **Assess Impact**: Determine the scope and severity of the issue
2. **Immediate Mitigation**: Deploy hotfixes for critical vulnerabilities
3. **Root Cause Analysis**: Identify how the issue was introduced
4. **Process Improvement**: Update guidelines and review processes
5. **Documentation**: Update this document with lessons learned

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Next.js Security Documentation](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices)

---

**Remember: Security is everyone's responsibility. When in doubt, choose the more secure approach and ask for review.**
