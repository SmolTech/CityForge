import { NextRequest, NextResponse } from "next/server";

/**
 * Global middleware for all requests
 * Enforces request body size limits to prevent DoS attacks
 */
export function middleware(request: NextRequest) {
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

  return NextResponse.next();
}

// Apply middleware to all API routes
export const config = {
  matcher: "/api/:path*",
};
