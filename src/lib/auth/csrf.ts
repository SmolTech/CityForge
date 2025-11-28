import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * CSRF Token Configuration
 *
 * We use the Double Submit Cookie pattern:
 * 1. Server generates a random CSRF token
 * 2. Server sends token in both:
 *    - A cookie (not httpOnly, so JS can read it)
 *    - Response header (for initial token retrieval)
 * 3. Client reads token from cookie and sends it in X-CSRF-Token header
 * 4. Server validates that cookie token matches header token
 *
 * This works because malicious sites cannot read cookies or set custom headers.
 */

export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_TOKEN_LENGTH = 32; // 32 bytes = 256 bits

/**
 * Generate a cryptographically secure random CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Set CSRF token cookie in response
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";

  // CSRF token cookie MUST be readable by JavaScript for Double Submit Cookie pattern
  // This is intentional and required for CSRF protection to work
  // nosemgrep: javascript.koa.web.cookies-httponly-false-koa.cookies-httponly-false-koa
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    path: "/",
    maxAge: 24 * 60 * 60, // 24 hours (same as auth token)
    sameSite: "lax",
    secure: isProduction,
  });

  // Also send in header for client convenience
  response.headers.set("X-CSRF-Token", token);
}

/**
 * Clear CSRF token cookie
 */
export function clearCsrfCookie(response: NextResponse): void {
  // CSRF token cookie MUST be readable by JavaScript for Double Submit Cookie pattern
  // nosemgrep: javascript.koa.web.cookies-httponly-false-koa.cookies-httponly-false-koa
  response.cookies.set(CSRF_COOKIE_NAME, "", {
    httpOnly: false,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
}

/**
 * Validate CSRF token from request
 *
 * Checks that:
 * 1. CSRF token exists in cookie
 * 2. CSRF token exists in header
 * 3. Both tokens match
 *
 * @param request - The incoming request
 * @returns True if CSRF token is valid, false otherwise
 */
export function validateCsrfToken(request: NextRequest): boolean {
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  // Get token from header (case-insensitive)
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  // Both must exist and match
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

/**
 * Check if request is exempt from CSRF validation
 *
 * CSRF protection is not needed for:
 * - Safe HTTP methods (GET, HEAD, OPTIONS) - already handled by HTTP semantics
 * - Mobile app requests using Bearer tokens instead of cookies
 */
export function isCsrfExempt(request: NextRequest): boolean {
  const method = request.method;

  // Safe methods don't need CSRF protection
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  // Mobile apps use Authorization header instead of cookies
  // If Authorization header is present, request is using Bearer token, not cookie
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return true;
  }

  return false;
}

/**
 * Middleware to validate CSRF tokens on state-changing requests
 *
 * Usage:
 * ```typescript
 * export const POST = withCsrfProtection(async (request) => {
 *   // Your handler code
 * });
 * ```
 */
export function withCsrfProtection(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Skip CSRF check for exempt requests
    if (isCsrfExempt(request)) {
      return handler(request);
    }

    // Validate CSRF token
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        {
          error: {
            message: "CSRF token validation failed",
            code: "CSRF_TOKEN_INVALID",
          },
        },
        { status: 403 }
      );
    }

    // CSRF token valid, proceed with request
    return handler(request);
  };
}
