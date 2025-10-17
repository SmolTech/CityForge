const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "" : "http://localhost:5000");

export class ApiClient {
  protected baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  protected getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("auth_token");
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401 && endpoint !== "/api/auth/login") {
          // Token expired or invalid (but not a login failure)
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth_token");
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
