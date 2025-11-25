import { NextRequest, NextResponse } from "next/server";
import { handleCORSPreflight, addCORSHeaders } from "@/lib/cors";

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
 * - Handles CORS for API routes when nginx proxy is not available
 * - Enforces request body size limits to prevent DoS attacks
 * - Implements server-side timeout protection to prevent resource exhaustion
 */
export async function middleware(request: NextRequest) {
  // Handle CORS preflight requests for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const preflightResponse = handleCORSPreflight(request);
    if (preflightResponse) {
      return preflightResponse;
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
          return NextResponse.json(
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
        }
      }
    }

    // Race between request processing and timeout
    const nextPromise = Promise.resolve(NextResponse.next());

    const response = await Promise.race([nextPromise, timeoutPromise]);

    // Add CORS headers to API responses when nginx proxy is not available
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return addCORSHeaders(response, request);
    }

    return response;
  } catch (error) {
    // Handle timeout errors
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
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
    }

    // Handle other unexpected errors
    return NextResponse.json(
      {
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      },
      { status: 500 }
    );
  }
}

// Apply middleware to all API routes
export const config = {
  matcher: "/api/:path*",
};
