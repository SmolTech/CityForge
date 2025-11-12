import { logger } from "@/lib/logger";
import { fetchWithTimeout, TimeoutError } from "@/lib/utils/fetch-timeout";

const API_BASE_URL =
  process.env["NEXT_PUBLIC_API_URL"] ||
  (typeof window !== "undefined" ? "" : "http://localhost:5000");

// Extend RequestInit to add custom options
interface CustomRequestInit extends RequestInit {
  skipAuthRedirect?: boolean;
}

export class ApiClient {
  protected baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  protected async request<T>(
    endpoint: string,
    options: CustomRequestInit = {}
  ): Promise<T> {
    // Extract custom options
    const { skipAuthRedirect, ...fetchOptionsBase } = options;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((fetchOptionsBase.headers as Record<string, string>) || {}),
    };

    // Configure Next.js fetch caching based on endpoint
    const fetchOptions: RequestInit = {
      ...fetchOptionsBase,
      headers,
      credentials: "include", // Include cookies in requests
    };

    // Add cache configuration for specific endpoints (only for GET requests)
    if (!options.method || options.method === "GET") {
      // Apply caching based on endpoint (skip caching for auth endpoints)
      if (!endpoint.includes("/api/auth/")) {
        if (endpoint.includes("/api/tags")) {
          fetchOptions.next = { revalidate: 300 }; // 5 minutes
        } else if (
          endpoint.includes("/api/site-config") ||
          endpoint.includes("/api/config")
        ) {
          fetchOptions.next = { revalidate: 600 }; // 10 minutes
        } else if (
          endpoint.includes("/api/cards") &&
          !endpoint.includes("/api/cards/")
        ) {
          fetchOptions.next = { revalidate: 60 }; // 1 minute for cards list
        } else if (endpoint.match(/\/api\/(cards|business)\/\d+/)) {
          fetchOptions.next = { revalidate: 300 }; // 5 minutes for individual cards
        } else if (endpoint.includes("/api/resources")) {
          fetchOptions.next = { revalidate: 300 }; // 5 minutes for resources
        }
      }
    }

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}${endpoint}`,
        fetchOptions
      );

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (
          response.status === 401 &&
          endpoint !== "/api/auth/login" &&
          endpoint !== "/api/auth/register" &&
          !skipAuthRedirect
        ) {
          // Token expired or invalid (but not a login failure)
          // Only redirect if skipAuthRedirect is not set (for protected pages)
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }

        // Try to extract structured error from response
        let errorMessage = `Request failed with status ${response.status}`;
        let errorDetails = null;

        try {
          const errorData = await response.json();
          // Check for structured error response
          if (errorData.error) {
            errorMessage = errorData.error.message || errorMessage;
            errorDetails = errorData.error.details;
          } else if (errorData.message) {
            // Fallback to simple message field
            errorMessage = errorData.message;
          }
        } catch {
          // If response is not JSON, use default message
        }

        const error = new Error(errorMessage) as Error & {
          status?: number;
          details?: unknown;
        };
        error.status = response.status;
        error.details = errorDetails;

        throw error;
      }

      return await response.json();
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof TimeoutError) {
        logger.error("Request timeout for", endpoint, ":", error.message);
        const timeoutError = new Error(
          "Request timed out. Please try again later."
        ) as Error & {
          status?: number;
          details?: unknown;
        };
        timeoutError.status = 408; // Request Timeout
        timeoutError.details = { originalError: error.message };
        throw timeoutError;
      }

      logger.error("API request failed for", endpoint, ":", error);
      throw error;
    }
  }
}
