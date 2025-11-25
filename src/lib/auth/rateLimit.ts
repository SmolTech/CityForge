/**
 * Authentication Rate Limiting
 *
 * Protects authentication endpoints against brute force attacks
 * using IP-based rate limiting with different limits per endpoint type.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Rate limiting configuration per endpoint type
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  description: string; // Human-readable description
}

// Rate limit configurations for different auth endpoints
export const AUTH_RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    description: "5 attempts per minute",
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    description: "3 registrations per hour",
  },
  "forgot-password": {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    description: "5 password reset requests per hour",
  },
  "reset-password": {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3,
    description: "3 password reset attempts per 15 minutes",
  },
  "resend-verification": {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    description: "5 verification emails per hour",
  },
  "verify-email": {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    description: "10 verification attempts per hour",
  },
} as const;

// In-memory storage for rate limiting (upgrade to Redis for production scale)
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries from the rate limit store
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 24 hours to prevent memory buildup
    if (now - entry.windowStart > 24 * 60 * 60 * 1000) {
      expiredKeys.push(key);
    }
  }

  expiredKeys.forEach((key) => rateLimitStore.delete(key));

  if (expiredKeys.length > 0) {
    logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupExpiredEntries, 30 * 60 * 1000);

/**
 * Get the client IP address from the request
 * Handles various proxy setups and forwarded headers
 */
function getClientIP(request: NextRequest): string {
  // Check standard forwarded headers (most proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first IP
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  // Check other common proxy headers
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const clientIP = request.headers.get("x-client-ip");
  if (clientIP) {
    return clientIP;
  }

  // Fallback for development/local
  // NextRequest doesn't have ip property in all environments
  return "127.0.0.1";
}

/**
 * Check if a request from the given IP is within the rate limit
 * for the specified authentication endpoint.
 *
 * Uses a sliding window approach for accurate rate limiting.
 */
export function checkAuthRateLimit(
  request: NextRequest,
  endpoint: keyof typeof AUTH_RATE_LIMITS
): {
  allowed: boolean;
  remainingRequests?: number;
  resetTime?: number;
  config: RateLimitConfig;
} {
  const config = AUTH_RATE_LIMITS[endpoint];
  if (!config) {
    logger.warn(`Unknown auth endpoint for rate limiting: ${endpoint}`);
    // Return a default config for unknown endpoints to allow through
    const defaultConfig: RateLimitConfig = {
      windowMs: 60 * 1000,
      maxRequests: 10,
      description: "10 requests per minute (default)",
    };
    return { allowed: true, config: defaultConfig };
  }

  const clientIP = getClientIP(request);
  const now = Date.now();
  const key = `auth:${endpoint}:${clientIP}`;

  const existing = rateLimitStore.get(key);

  // If no existing entry or window has expired, start fresh
  if (!existing || now - existing.windowStart >= config.windowMs) {
    const newEntry: RateLimitEntry = {
      count: 1,
      windowStart: now,
    };
    rateLimitStore.set(key, newEntry);

    return {
      allowed: true,
      remainingRequests: config.maxRequests - 1,
      resetTime: now + config.windowMs,
      config,
    };
  }

  // Check if we're within the limit
  if (existing.count >= config.maxRequests) {
    const resetTime = existing.windowStart + config.windowMs;

    logger.warn(`Rate limit exceeded for ${endpoint}`, {
      clientIP,
      endpoint,
      count: existing.count,
      maxRequests: config.maxRequests,
      windowStart: existing.windowStart,
      resetTime,
    });

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime,
      config,
    };
  }

  // Increment count and allow request
  existing.count += 1;

  return {
    allowed: true,
    remainingRequests: config.maxRequests - existing.count,
    resetTime: existing.windowStart + config.windowMs,
    config,
  };
}

/**
 * Create a rate limit exceeded response with proper headers
 */
export function createRateLimitResponse(
  endpoint: string,
  resetTime: number,
  config: RateLimitConfig
): NextResponse {
  const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000);

  const response = NextResponse.json(
    {
      error: {
        message: "Rate limit exceeded. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
        details: {
          endpoint,
          limit: config.description,
          retryAfterSeconds,
        },
      },
    },
    { status: 429 }
  );

  // Add standard rate limiting headers
  response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
  response.headers.set("X-RateLimit-Remaining", "0");
  response.headers.set(
    "X-RateLimit-Reset",
    Math.ceil(resetTime / 1000).toString()
  );
  response.headers.set("Retry-After", retryAfterSeconds.toString());

  return response;
}

/**
 * Middleware wrapper to add rate limiting to authentication endpoints.
 *
 * Usage:
 * ```typescript
 * export const POST = withAuthRateLimit('login', async (request) => {
 *   // Your endpoint logic here
 * });
 * ```
 */
export function withAuthRateLimit<T extends unknown[]>(
  endpoint: keyof typeof AUTH_RATE_LIMITS,
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const rateLimit = checkAuthRateLimit(request, endpoint);

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        endpoint,
        rateLimit.resetTime!,
        rateLimit.config
      );
    }

    // Add rate limit headers to successful responses
    const response = await handler(request, ...args);

    if (rateLimit.remainingRequests !== undefined) {
      response.headers.set(
        "X-RateLimit-Limit",
        rateLimit.config.maxRequests.toString()
      );
      response.headers.set(
        "X-RateLimit-Remaining",
        rateLimit.remainingRequests.toString()
      );
    }

    if (rateLimit.resetTime !== undefined) {
      response.headers.set(
        "X-RateLimit-Reset",
        Math.ceil(rateLimit.resetTime / 1000).toString()
      );
    }

    return response;
  };
}

/**
 * Get current rate limit status for debugging/monitoring
 */
export function getRateLimitStatus(
  request: NextRequest,
  endpoint: keyof typeof AUTH_RATE_LIMITS
): {
  ip: string;
  endpoint: string;
  current: number;
  limit: number;
  windowStart: number;
  resetTime: number;
} | null {
  const config = AUTH_RATE_LIMITS[endpoint];
  if (!config) return null;

  const clientIP = getClientIP(request);
  const key = `auth:${endpoint}:${clientIP}`;
  const existing = rateLimitStore.get(key);

  if (!existing) {
    return {
      ip: clientIP,
      endpoint,
      current: 0,
      limit: config.maxRequests,
      windowStart: Date.now(),
      resetTime: Date.now() + config.windowMs,
    };
  }

  return {
    ip: clientIP,
    endpoint,
    current: existing.count,
    limit: config.maxRequests,
    windowStart: existing.windowStart,
    resetTime: existing.windowStart + config.windowMs,
  };
}

/**
 * Clear all rate limiting data - for testing purposes only
 * @internal
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
