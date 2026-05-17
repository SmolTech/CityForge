# CSRF Protection Implementation

## Overview

CityForge implements comprehensive Cross-Site Request Forgery (CSRF) protection using a multi-layered approach that combines multiple security mechanisms.

## Security Layers

### Layer 1: SameSite Cookie Attribute (Primary Defense)

**Implementation**: All authentication cookies are set with `SameSite=Lax`

```typescript
response.cookies.set("access_token_cookie", token, {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  // ...
});
```

**Protection**:

- Prevents cookies from being sent on cross-origin POST requests
- Cookies ARE sent on safe methods (GET, HEAD, OPTIONS) from other sites
- Cookies ARE sent when users navigate to the site from external links

**Coverage**:

- ✅ Blocks most CSRF attacks (POST-based form submissions from malicious sites)
- ✅ Allows legitimate top-level navigation
- ✅ Supported by all modern browsers (>95% coverage)

**Limitations**:

- Does not protect against attacks using GET requests (but we don't use GET for state changes)
- Older browsers (<5%) don't support SameSite

### Layer 2: Double Submit Cookie Pattern (Defense-in-Depth)

**Implementation**: Additional CSRF tokens for state-changing operations

#### Server-Side

1. **Token Generation** (`src/lib/auth/csrf.ts`):
   - Cryptographically secure random token (32 bytes / 256 bits)
   - Generated on login/registration
   - Sent in both cookie and response header

2. **Token Storage**:

   ```typescript
   // Non-httpOnly cookie (JavaScript can read it)
   response.cookies.set("csrf_token", token, {
     httpOnly: false, // Important!
     sameSite: "lax",
     secure: isProduction,
   });

   // Also in response header
   response.headers.set("X-CSRF-Token", token);
   ```

3. **Token Validation**:

   ```typescript
   // Middleware validates on POST, PUT, PATCH, DELETE
   export function withCsrfProtection(handler) {
     return async (request) => {
       if (isCsrfExempt(request)) {
         return handler(request);
       }

       if (!validateCsrfToken(request)) {
         return 403; // Forbidden
       }

       return handler(request);
     };
   }
   ```

#### Client-Side

1. **Token Retrieval** (`src/lib/api/client.ts`):

   ```typescript
   function getCsrfToken(): string | null {
     const cookies = document.cookie.split(";");
     // Find csrf_token cookie
     return cookieValue;
   }
   ```

2. **Token Submission**:
   ```typescript
   // Automatically added to state-changing requests
   if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
     headers["X-CSRF-Token"] = getCsrfToken();
   }
   ```

**How It Works**:

- Malicious sites can cause cookies to be sent (via forms/images)
- But they **cannot** read cookies (Same-Origin Policy)
- And they **cannot** set custom headers (CORS)
- Our legitimate frontend can both read the cookie AND set the header

**Protection**:

- ✅ Defense-in-depth for state-changing operations
- ✅ Works even if SameSite is not supported
- ✅ Compatible with both web and mobile clients

### Layer 3: Mobile App Exemption

Mobile applications don't use cookies and are exempt from CSRF protection:

```typescript
export function isCsrfExempt(request: NextRequest): boolean {
  // Mobile apps use Authorization header instead of cookies
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return true; // Not vulnerable to CSRF
  }
  return false;
}
```

**Rationale**:

- Mobile apps don't use cookies (use Bearer tokens in Authorization header)
- CSRF attacks exploit automatic cookie submission by browsers
- Mobile HTTP clients don't automatically send credentials
- No CSRF vulnerability exists for Bearer token authentication

## Attack Scenarios Prevented

### Scenario 1: Malicious Form Submission

**Attack**:

```html
<!-- Malicious site tries to submit a form -->
<form action="https://cityforge.com/api/cards" method="POST">
  <input name="name" value="Malicious Business" />
  <input type="submit" />
</form>
```

**Defense**:

- ✅ SameSite=Lax prevents cookie from being sent with cross-origin POST
- ✅ Even if cookie was sent, request would fail CSRF validation (no token in header)

### Scenario 2: Malicious AJAX Request

**Attack**:

```javascript
// Malicious site tries to make AJAX request
fetch("https://cityforge.com/api/cards", {
  method: "POST",
  credentials: "include", // Try to send cookies
  body: JSON.stringify({ name: "Malicious" }),
});
```

**Defense**:

- ✅ CORS blocks the request (can't read CSRF token)
- ✅ Can't set custom headers (X-CSRF-Token)
- ✅ SameSite=Lax prevents cookies in cross-origin POST

### Scenario 3: Image Tag Exploit

**Attack**:

```html
<!-- Try to trigger state change via image -->
<img src="https://cityforge.com/api/cards/123?action=delete" />
```

**Defense**:

- ✅ We don't use GET for state-changing operations
- ✅ All state changes require POST/PUT/DELETE
- ✅ POST/PUT/DELETE blocked by SameSite and CSRF token

## Implementation Details

### Token Lifecycle

1. **Generation**: On login/register
2. **Storage**: In non-httpOnly cookie + response header
3. **Transmission**: In X-CSRF-Token header for state-changing requests
4. **Validation**: Server checks cookie matches header
5. **Expiration**: Same as auth token (24 hours)
6. **Refresh**: New token on each login
7. **Cleanup**: Cleared on logout

### Testing

Comprehensive test suite (`src/lib/auth/csrf.test.ts`):

- ✅ Token generation (uniqueness, format)
- ✅ Token validation (match, mismatch, missing)
- ✅ Exemption logic (GET, Bearer tokens)
- ✅ Middleware integration
- ✅ 21 test cases covering all scenarios

## Usage

### Applying CSRF Protection to an Endpoint

```typescript
import { withCsrfProtection } from "@/lib/auth/csrf";

export const POST = withCsrfProtection(async (request) => {
  // Your handler code
  // CSRF token already validated
});
```

### When to Apply

**Apply to**:

- All state-changing operations (POST, PUT, PATCH, DELETE)
- Operations using cookie authentication

**Don't apply to**:

- Read-only operations (GET, HEAD, OPTIONS)
- Endpoints using Bearer token authentication
- Public endpoints with no authentication

## Security Considerations

### Why Double Submit Cookie?

Other CSRF patterns considered:

1. **Synchronizer Token Pattern**: Requires server-side session storage
   - ❌ Doesn't work well with stateless JWT
   - ❌ Complicates horizontal scaling

2. **Encrypted Token Pattern**: Embed user ID in token
   - ❌ More complex implementation
   - ❌ Potential timing attacks

3. **Double Submit Cookie**: Our choice
   - ✅ Stateless (works with JWT)
   - ✅ Simple implementation
   - ✅ Industry standard
   - ✅ Works with distributed systems

### Limitations

- Requires JavaScript (cookie must be readable)
  - This is fine for our SPA architecture

- Subdomain attacks possible if cookies not properly scoped
  - Mitigated by proper cookie domain configuration

- Does not prevent login CSRF
  - Not relevant for our application (no sensitive info on login)

## Browser Compatibility

- **SameSite=Lax**: Supported by all modern browsers (>95%)
- **CSRF Tokens**: Universal support (works everywhere)
- **Combined**: Near 100% coverage

## Monitoring

CSRF token failures are logged for security monitoring:

```typescript
if (!validateCsrfToken(request)) {
  logger.warn("CSRF token validation failed", {
    endpoint: request.url,
    method: request.method,
    hasHeader: !!headerToken,
    hasCookie: !!cookieToken,
  });
  return 403;
}
```

## Future Enhancements

Potential improvements:

1. **Token Rotation**: Rotate CSRF tokens periodically
2. **Origin Validation**: Additional check of Origin/Referer headers
3. **Custom Token Per Operation**: Different tokens for different endpoints
4. **Rate Limiting**: Limit failed CSRF attempts

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
- [SameSite Cookie Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
