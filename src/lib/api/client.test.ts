import { describe, test, expect, vi, beforeEach } from "vitest";
import { ApiClient } from "./client";
import { TimeoutError } from "@/lib/utils/fetch-timeout";

// Mock the logger to avoid console output in tests
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock fetchWithTimeout to intercept the actual fetch calls
let mockFetchWithTimeout: ReturnType<typeof vi.fn>;

vi.mock("@/lib/utils/fetch-timeout", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/utils/fetch-timeout")
  >("@/lib/utils/fetch-timeout");
  return {
    ...actual,
    fetchWithTimeout: vi.fn(),
    TimeoutError: actual.TimeoutError,
  };
});

// Extend RequestInit to add custom options (matching actual implementation)
interface CustomRequestInit extends RequestInit {
  skipAuthRedirect?: boolean;
}

// Test class that extends ApiClient to access protected methods
class TestApiClient extends ApiClient {
  public async testRequest<T>(
    endpoint: string,
    options?: CustomRequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, options);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}

describe("ApiClient", () => {
  let apiClient: TestApiClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock for document (needed for CSRF token tests)
    globalThis.document = {
      cookie: "",
      querySelector: vi.fn(),
    } as never;

    // Get the mocked fetchWithTimeout
    const { fetchWithTimeout } = await import("@/lib/utils/fetch-timeout");
    mockFetchWithTimeout = fetchWithTimeout as ReturnType<typeof vi.fn>;

    // Create fresh instance for each test
    apiClient = new TestApiClient();
  });

  describe("CSRF token management", () => {
    test("should include CSRF token for state-changing requests (POST)", async () => {
      globalThis.document.cookie = "csrf_token=test-csrf-token";

      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/test", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/test"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-CSRF-Token": "test-csrf-token",
          }),
        })
      );
    });

    test("should not include CSRF token for GET requests", async () => {
      globalThis.document.cookie = "csrf_token=test-csrf-token";

      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/test", { method: "GET" });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/test"),
        expect.objectContaining({
          method: "GET",
          headers: expect.not.objectContaining({
            "X-CSRF-Token": expect.anything(),
          }),
        })
      );
    });

    test("should handle missing CSRF token gracefully", async () => {
      globalThis.document.cookie = "";

      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/test", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/test"),
        expect.objectContaining({
          method: "POST",
          headers: expect.not.objectContaining({
            "X-CSRF-Token": expect.anything(),
          }),
        })
      );
    });

    test("should handle CSRF token with multiple cookies", async () => {
      globalThis.document.cookie =
        "other=value; csrf_token=my-token; session=abc123";

      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/test", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/test"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-CSRF-Token": "my-token",
          }),
        })
      );
    });
  });

  describe("Next.js fetch caching", () => {
    test("should include revalidate config for tags endpoints", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/tags");

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/tags"),
        expect.objectContaining({
          next: { revalidate: 300 },
        })
      );
    });

    test("should not include cache config for POST requests", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/cards", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/cards"),
        expect.not.objectContaining({
          next: expect.anything(),
        })
      );
    });

    test("should include specific revalidate config for config endpoints", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/config");

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/config"),
        expect.objectContaining({
          next: { revalidate: 600 },
        })
      );
    });

    test("should include specific cache config for cards list", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/cards");

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/cards"),
        expect.objectContaining({
          next: { revalidate: 60 },
        })
      );
    });

    test("should include specific cache config for individual cards", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/cards/123");

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/cards/123"),
        expect.objectContaining({
          next: { revalidate: 300 },
        })
      );
    });

    test("should not include cache config for auth endpoints", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/auth/login");

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/login"),
        expect.not.objectContaining({
          next: expect.anything(),
        })
      );
    });
  });

  describe("error handling", () => {
    test("should redirect on 401 errors in browser environment", async () => {
      // Setup browser environment for this test
      const mockLocation = { href: "" };
      globalThis.window = { location: mockLocation } as never;

      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: "Unauthorized" } }),
      });

      try {
        await apiClient.testRequest("/api/protected");
      } catch {
        // Expected to throw, but we're testing the redirect side effect
      }

      expect(mockLocation.href).toBe("/login");
    });

    test("should not redirect on 401 for login endpoints", async () => {
      const mockLocation = { href: "" };
      globalThis.window = { location: mockLocation } as never;

      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ error: { message: "Invalid credentials" } }),
      });

      try {
        await apiClient.testRequest("/api/auth/login");
      } catch {
        // Expected to throw
      }

      // Should not redirect for login failures
      expect(mockLocation.href).toBe("");
    });

    test("should handle timeout errors properly", async () => {
      const timeoutError = new TimeoutError(30000, "/api/test");
      mockFetchWithTimeout.mockRejectedValue(timeoutError);

      try {
        await apiClient.testRequest("/api/test");
      } catch (error: unknown) {
        const caughtError = error as {
          message: string;
          status: number;
          details: { originalError: string };
        };
        expect(caughtError.message).toBe(
          "Request timed out. Please try again later."
        );
        expect(caughtError.status).toBe(408);
        expect(caughtError.details).toEqual({
          originalError: "Request timeout after 30000ms for /api/test",
        });
      }
    });

    test("should handle structured error responses", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: {
              message: "Validation failed",
              details: { field: "error message" },
            },
          }),
      });

      try {
        await apiClient.testRequest("/api/test");
      } catch (error: unknown) {
        const validationError = error as {
          message: string;
          status: number;
          details: { field: string };
        };
        expect(validationError.message).toBe("Validation failed");
        expect(validationError.status).toBe(400);
        expect(validationError.details).toEqual({ field: "error message" });
      }
    });

    test("should handle non-JSON error responses", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Not JSON")),
      });

      try {
        await apiClient.testRequest("/api/test");
      } catch (error: unknown) {
        const serverError = error as {
          message: string;
          status: number;
        };
        expect(serverError.message).toBe("Request failed with status 500");
        expect(serverError.status).toBe(500);
      }
    });
  });

  describe("request configuration", () => {
    test("should include credentials and content-type headers", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/test", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    test("should merge custom headers with default headers", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiClient.testRequest("/api/test", {
        headers: {
          "Custom-Header": "custom-value",
        },
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "Custom-Header": "custom-value",
          }),
        })
      );
    });

    test("should handle custom options properly", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const abortController = new AbortController();
      await apiClient.testRequest("/api/test", {
        method: "PUT",
        body: JSON.stringify({ test: "data" }),
        signal: abortController.signal,
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: '{"test":"data"}',
          signal: expect.any(AbortSignal),
        })
      );
    });

    test("should preserve skipAuthRedirect option", async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: "Unauthorized" } }),
      });

      const mockLocation = { href: "" };
      globalThis.window = { location: mockLocation } as never;

      try {
        await apiClient.testRequest("/api/test", { skipAuthRedirect: true });
      } catch {
        // Expected to throw
      }

      // Should not redirect because skipAuthRedirect is true
      expect(mockLocation.href).toBe("");
    });
  });
});
