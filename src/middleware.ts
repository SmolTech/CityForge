import { NextRequest, NextResponse } from "next/server";
import { handleCORSPreflight, addCORSHeaders } from "@/lib/cors";
import { addSecurityHeaders } from "@/lib/security-headers";
import { createTimingMiddleware } from "@/lib/monitoring/metrics";

/**
 * Request timeout configuration for different endpoint types
 */
const MIDDLEWARE_TIMEOUTS = {
  auth: 10000, // 10 seconds for auth operations
  upload: 60000, // 60 seconds for file uploads
  admin: 45000, // 45 seconds for admin operations
  search: 30000, // 30 seconds for search operations
  default: 30000, // 30 seconds default
} as const;

/**
 * Determine appropriate server timeout based on endpoint
 */
function getServerTimeout(pathname: string): number {
  if (pathname.includes("/api/auth/")) {
    return MIDDLEWARE_TIMEOUTS.auth;
  }
  if (pathname.includes("/api/upload")) {
    return MIDDLEWARE_TIMEOUTS.upload;
  }
  if (pathname.includes("/api/admin/")) {
    return MIDDLEWARE_TIMEOUTS.admin;
  }
  if (pathname.includes("/api/search")) {
    return MIDDLEWARE_TIMEOUTS.search;
  }
  return MIDDLEWARE_TIMEOUTS.default;
}

/**
 * Global middleware for all requests
 * - Tracks HTTP request metrics (timing, status codes, error rates)
 * - Handles CORS for API routes when nginx proxy is not available
 * - Enforces comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Enforces request body size limits to prevent DoS attacks
 * - Implements server-side timeout protection to prevent resource exhaustion
 */
export async function middleware(request: NextRequest) {
  console.log("[MIDDLEWARE DEBUG] Called for:", {
    pathname: request.nextUrl.pathname,
    method: request.method,
  });

  // Initialize metrics tracking for all requests
  const timing = createTimingMiddleware();
  const requestStart = timing.start();
  const path = request.nextUrl.pathname;

  // Debug logging for E2E tests - ALL requests, not just auth
  const isE2ETest = process.env["PLAYWRIGHT_E2E_TESTING"] === "true";
  if (isE2ETest) {
    console.log("[MIDDLEWARE] Request:", {
      method: request.method,
      path: path,
      userAgent: request.headers.get("user-agent")?.substring(0, 50),
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      isAuthRequest: path.includes("/api/auth/"),
    });
  }

  // Handle CORS preflight requests for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const preflightResponse = handleCORSPreflight(request);
    if (preflightResponse) {
      // Track preflight requests in metrics
      timing.end(requestStart, preflightResponse.status, `${path}:OPTIONS`);
      // Apply security headers to CORS preflight responses
      return addSecurityHeaders(preflightResponse, request);
    }
  }

  // Server-side timeout protection
  const timeoutMs = getServerTimeout(request.nextUrl.pathname);

  const timeoutPromise = new Promise<NextResponse>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Server timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    // Check content-length header for POST/PUT/PATCH requests
    if (
      request.method === "POST" ||
      request.method === "PUT" ||
      request.method === "PATCH"
    ) {
      const contentLength = request.headers.get("content-length");

      if (contentLength) {
        const size = parseInt(contentLength, 10);

        // Maximum request body size: 10MB
        // This prevents attackers from exhausting server resources
        const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB in bytes

        if (size > MAX_BODY_SIZE) {
          const bodyErrorResponse = NextResponse.json(
            {
              error: {
                message: "Request body too large",
                code: "PAYLOAD_TOO_LARGE",
                details: {
                  maxSize: "10MB",
                  receivedSize: `${(size / 1024 / 1024).toFixed(2)}MB`,
                },
              },
            },
            { status: 413 }
          );

          // Track error in metrics
          timing.end(requestStart, 413, path);
          // Apply security headers to error responses
          return addSecurityHeaders(bodyErrorResponse, request);
        }
      }
    }

    // Race between request processing and timeout
    const nextPromise = Promise.resolve(NextResponse.next());

    let response = await Promise.race([nextPromise, timeoutPromise]);

    // Debug logging for E2E tests - track response
    if (isE2ETest) {
      console.log("[MIDDLEWARE] Response:", {
        method: request.method,
        path: path,
        status: response.status,
        isAuthRequest: path.includes("/api/auth/"),
        hasHeaders: response.headers.has("content-type"),
      });
    }

    // Track successful request in metrics
    timing.end(requestStart, response.status, path);

    // Add security headers to all responses
    response = addSecurityHeaders(response, request);

    // Add CORS headers to API responses when nginx proxy is not available
    if (request.nextUrl.pathname.startsWith("/api/")) {
      response = addCORSHeaders(response, request);
    }

    return response;
  } catch (error) {
    // Handle timeout errors
    if (error instanceof Error && error.message.includes("timeout")) {
      const timeoutResponse = NextResponse.json(
        {
          error: {
            message: "Request timeout - server took too long to respond",
            code: "REQUEST_TIMEOUT",
            details: {
              timeout: `${timeoutMs}ms`,
            },
          },
        },
        { status: 504 } // Gateway Timeout
      );

      // Track timeout in metrics
      timing.end(requestStart, 504, path);
      // Apply security headers to error responses
      return addSecurityHeaders(timeoutResponse, request);
    }

    // Handle other unexpected errors
    const errorResponse = NextResponse.json(
      {
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      },
      { status: 500 }
    );

    // Track error in metrics
    timing.end(requestStart, 500, path);
    // Apply security headers to error responses
    return addSecurityHeaders(errorResponse, request);
  }
}

// Apply middleware to all routes for security headers, with specific CORS handling for API routes
export const config = {
  matcher: [
    // Apply to all routes except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
