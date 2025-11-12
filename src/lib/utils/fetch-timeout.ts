/**
 * Fetch timeout utility to prevent resource exhaustion attacks
 *
 * Provides configurable timeouts for HTTP requests to protect against:
 * - Slowloris attacks
 * - Connection pool exhaustion
 * - Memory leaks from hung connections
 * - Service degradation from slow responses
 */

import { logger } from "@/lib/logger";

/**
 * Timeout configuration for different types of requests
 */
export const TIMEOUT_CONFIGS = {
  // Authentication operations - require fast response
  auth: 10000, // 10 seconds

  // Simple read operations
  read: 15000, // 15 seconds

  // Complex queries and searches
  complex: 30000, // 30 seconds

  // File uploads and heavy operations
  upload: 60000, // 60 seconds

  // Default timeout for all other requests
  default: 30000, // 30 seconds

  // Admin operations (can be slower)
  admin: 45000, // 45 seconds
} as const;

/**
 * Custom error type for timeout errors
 */
export class TimeoutError extends Error {
  constructor(timeoutMs: number, url: string) {
    super(`Request timeout after ${timeoutMs}ms for ${url}`);
    this.name = "TimeoutError";
  }
}

/**
 * Determine appropriate timeout based on endpoint
 */
export function getTimeoutForEndpoint(endpoint: string): number {
  // Authentication endpoints
  if (endpoint.includes("/api/auth/")) {
    return TIMEOUT_CONFIGS.auth;
  }

  // File upload endpoints
  if (endpoint.includes("/api/upload")) {
    return TIMEOUT_CONFIGS.upload;
  }

  // Admin endpoints
  if (endpoint.includes("/api/admin/")) {
    return TIMEOUT_CONFIGS.admin;
  }

  // Search endpoints (can be complex)
  if (endpoint.includes("/api/search")) {
    return TIMEOUT_CONFIGS.complex;
  }

  // Complex submission endpoints
  if (
    endpoint.includes("/api/submissions") ||
    endpoint.includes("/suggest-edit")
  ) {
    return TIMEOUT_CONFIGS.complex;
  }

  // Simple read operations (cards, tags, resources)
  if (
    endpoint.includes("/api/cards") ||
    endpoint.includes("/api/tags") ||
    endpoint.includes("/api/resources") ||
    endpoint.includes("/api/site-config") ||
    endpoint.includes("/api/business/")
  ) {
    return TIMEOUT_CONFIGS.read;
  }

  // Default timeout for all other endpoints
  return TIMEOUT_CONFIGS.default;
}

/**
 * Fetch with configurable timeout using AbortController
 *
 * @param url - URL to fetch
 * @param options - Fetch options (RequestInit)
 * @param timeoutMs - Timeout in milliseconds (optional, will auto-detect from URL)
 * @returns Promise<Response>
 * @throws TimeoutError when request times out
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<Response> {
  // Determine timeout based on endpoint if not explicitly provided
  const timeout = timeoutMs ?? getTimeoutForEndpoint(url);

  // Create abort controller for timeout
  const controller = new AbortController();

  // Set up timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  // Merge abort signal with existing signal (if any)
  const existingSignal = options.signal;
  let combinedSignal = controller.signal;

  // If there's an existing signal, create a combined one
  if (existingSignal) {
    const combinedController = new AbortController();
    combinedSignal = combinedController.signal;

    // Abort combined signal if either signal is aborted
    const abortCombined = () => combinedController.abort();

    if (existingSignal.aborted) {
      abortCombined();
    } else {
      existingSignal.addEventListener("abort", abortCombined, { once: true });
    }

    if (controller.signal.aborted) {
      abortCombined();
    } else {
      controller.signal.addEventListener("abort", abortCombined, {
        once: true,
      });
    }
  }

  // Log timeout configuration in development
  if (process.env.NODE_ENV === "development") {
    logger.debug(`Request timeout set to ${timeout}ms for ${url}`);
  }

  // Execute fetch with timeout
  try {
    const response = await fetch(url, {
      ...options,
      signal: combinedSignal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Convert AbortError to TimeoutError for better error handling
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn(`Request timed out after ${timeout}ms for ${url}`);
      throw new TimeoutError(timeout, url);
    }

    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Convenience function to fetch with automatic timeout detection
 * and JSON parsing
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<T> {
  const response = await fetchWithTimeout(url, options, timeoutMs);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
