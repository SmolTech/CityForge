const API_BASE_URL =
  process.env["NEXT_PUBLIC_API_URL"] ||
  (typeof window !== "undefined" ? "" : "http://localhost:5000");

export class ApiClient {
  protected baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    // Configure Next.js fetch caching based on endpoint
    const fetchOptions: RequestInit = {
      ...options,
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
      const response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401 && endpoint !== "/api/auth/login") {
          // Token expired or invalid (but not a login failure)
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
      console.error("API request failed for", endpoint, ":", error);
      throw error;
    }
  }
}
