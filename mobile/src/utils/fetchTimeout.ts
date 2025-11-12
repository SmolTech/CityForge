/**
 * Fetch timeout utility for React Native/Expo
 *
 * Provides configurable timeouts for HTTP requests to protect against:
 * - Slowloris attacks
 * - Connection pool exhaustion
 * - Memory leaks from hung connections
 * - Service degradation from slow responses
 */

import { logger } from "./logger";

/**
 * Timeout configuration for different types of requests
 */
export const MOBILE_TIMEOUT_CONFIGS = {
  // Authentication operations - require fast response
  auth: 10000, // 10 seconds

  // Simple read operations
  read: 15000, // 15 seconds

  // Complex queries and searches
  complex: 30000, // 30 seconds

  // File uploads and heavy operations (not used in mobile currently)
  upload: 60000, // 60 seconds

  // Default timeout for all other requests
  default: 20000, // 20 seconds (shorter for mobile)
} as const;

/**
 * Custom error type for timeout errors
 */
export class MobileTimeoutError extends Error {
  constructor(timeoutMs: number, url: string) {
    super(`Request timeout after ${timeoutMs}ms for ${url}`);
    this.name = "MobileTimeoutError";
  }
}

/**
 * Determine appropriate timeout based on endpoint
 */
export function getMobileTimeoutForEndpoint(endpoint: string): number {
  // Authentication endpoints
  if (endpoint.includes("/api/auth/")) {
    return MOBILE_TIMEOUT_CONFIGS.auth;
  }

  // Search endpoints (can be complex)
  if (endpoint.includes("/api/search")) {
    return MOBILE_TIMEOUT_CONFIGS.complex;
  }

  // Complex submission endpoints
  if (
    endpoint.includes("/api/submissions") ||
    endpoint.includes("/suggest-edit")
  ) {
    return MOBILE_TIMEOUT_CONFIGS.complex;
  }

  // Simple read operations (cards, tags, resources)
  if (
    endpoint.includes("/api/cards") ||
    endpoint.includes("/api/tags") ||
    endpoint.includes("/api/resources") ||
    endpoint.includes("/api/site-config") ||
    endpoint.includes("/api/business/")
  ) {
    return MOBILE_TIMEOUT_CONFIGS.read;
  }

  // Default timeout for all other endpoints
  return MOBILE_TIMEOUT_CONFIGS.default;
}

/**
 * Fetch with configurable timeout using AbortController
 *
 * @param url - URL to fetch
 * @param options - Fetch options (RequestInit)
 * @param timeoutMs - Timeout in milliseconds (optional, will auto-detect from URL)
 * @returns Promise<Response>
 * @throws MobileTimeoutError when request times out
 */
export async function fetchWithMobileTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<Response> {
  // Determine timeout based on endpoint if not explicitly provided
  const timeout = timeoutMs ?? getMobileTimeoutForEndpoint(url);

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
  if (__DEV__) {
    logger.debug(`Mobile request timeout set to ${timeout}ms for ${url}`);
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

    // Convert AbortError to MobileTimeoutError for better error handling
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn(`Mobile request timed out after ${timeout}ms for ${url}`);
      throw new MobileTimeoutError(timeout, url);
    }

    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Convenience function to fetch with automatic timeout detection
 * and JSON parsing for mobile
 */
export async function fetchMobileJsonWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<T> {
  const response = await fetchWithMobileTimeout(url, options, timeoutMs);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
