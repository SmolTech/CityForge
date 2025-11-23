import { NextResponse } from "next/server";
import { createTimingMiddleware } from "./metrics";

/**
 * Middleware for automatically tracking API request metrics
 *
 * Wraps API route handlers to automatically record:
 * - Request timing
 * - Status codes
 * - Error rates
 * - Request counts
 */
export function withMetrics<T extends unknown[]>(
  handler: (...args: T) => Promise<Response | NextResponse>,
  routeName?: string
) {
  return async (...args: T): Promise<Response | NextResponse> => {
    const timing = createTimingMiddleware();
    const startTime = timing.start();

    // Extract request from args (usually first argument)
    let path = routeName || "unknown";
    if (args[0] && typeof args[0] === "object" && "url" in args[0]) {
      const url = new URL(args[0].url as string);
      path = url.pathname;
    }

    try {
      const response = await handler(...args);

      // Track successful request
      const status = response.status || 200;
      timing.end(startTime, status, path);

      return response;
    } catch (error) {
      // Track error
      timing.end(startTime, 500, path);
      throw error;
    }
  };
}

/**
 * Simple request tracking function for use in existing routes
 */
export function trackAPIRequest(
  path: string,
  statusCode: number,
  duration?: number
) {
  const timing = createTimingMiddleware();

  if (duration !== undefined) {
    // Manual timing
    timing.end(Date.now() - duration, statusCode, path);
  } else {
    // Just track the request count and status
    timing.end(Date.now(), statusCode, path);
  }
}
