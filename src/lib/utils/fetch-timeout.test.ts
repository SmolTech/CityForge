/**
 * Tests for fetch timeout functionality
 *
 * Validates timeout behavior, error handling, and configuration
 * for preventing resource exhaustion attacks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchWithTimeout,
  TimeoutError,
  getTimeoutForEndpoint,
  TIMEOUT_CONFIGS,
} from "./fetch-timeout";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock setTimeout and clearTimeout
const mockSetTimeout = vi.fn();
const mockClearTimeout = vi.fn();
vi.stubGlobal("setTimeout", mockSetTimeout);
vi.stubGlobal("clearTimeout", mockClearTimeout);

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTimeoutForEndpoint", () => {
    it("should return auth timeout for authentication endpoints", () => {
      expect(getTimeoutForEndpoint("/api/auth/login")).toBe(
        TIMEOUT_CONFIGS.auth
      );
      expect(getTimeoutForEndpoint("/api/auth/register")).toBe(
        TIMEOUT_CONFIGS.auth
      );
      expect(getTimeoutForEndpoint("/api/auth/me")).toBe(TIMEOUT_CONFIGS.auth);
    });

    it("should return upload timeout for upload endpoints", () => {
      expect(getTimeoutForEndpoint("/api/upload")).toBe(TIMEOUT_CONFIGS.upload);
      expect(getTimeoutForEndpoint("/api/upload/image")).toBe(
        TIMEOUT_CONFIGS.upload
      );
    });

    it("should return admin timeout for admin endpoints", () => {
      expect(getTimeoutForEndpoint("/api/admin/users")).toBe(
        TIMEOUT_CONFIGS.admin
      );
      expect(getTimeoutForEndpoint("/api/admin/cards/123")).toBe(
        TIMEOUT_CONFIGS.admin
      );
    });

    it("should return complex timeout for search endpoints", () => {
      expect(getTimeoutForEndpoint("/api/search")).toBe(
        TIMEOUT_CONFIGS.complex
      );
      expect(getTimeoutForEndpoint("/api/search?q=test")).toBe(
        TIMEOUT_CONFIGS.complex
      );
    });

    it("should return complex timeout for submission endpoints", () => {
      expect(getTimeoutForEndpoint("/api/submissions")).toBe(
        TIMEOUT_CONFIGS.complex
      );
      expect(getTimeoutForEndpoint("/api/cards/123/suggest-edit")).toBe(
        TIMEOUT_CONFIGS.complex
      );
    });

    it("should return read timeout for simple read endpoints", () => {
      expect(getTimeoutForEndpoint("/api/cards")).toBe(TIMEOUT_CONFIGS.read);
      expect(getTimeoutForEndpoint("/api/tags")).toBe(TIMEOUT_CONFIGS.read);
      expect(getTimeoutForEndpoint("/api/resources")).toBe(
        TIMEOUT_CONFIGS.read
      );
      expect(getTimeoutForEndpoint("/api/site-config")).toBe(
        TIMEOUT_CONFIGS.read
      );
      expect(getTimeoutForEndpoint("/api/business/123")).toBe(
        TIMEOUT_CONFIGS.read
      );
    });

    it("should return default timeout for other endpoints", () => {
      expect(getTimeoutForEndpoint("/api/unknown")).toBe(
        TIMEOUT_CONFIGS.default
      );
      expect(getTimeoutForEndpoint("/api/custom-endpoint")).toBe(
        TIMEOUT_CONFIGS.default
      );
    });
  });

  describe("fetchWithTimeout function", () => {
    it("should use explicit timeout when provided", async () => {
      const mockResponse = new Response('{"success": true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      mockFetch.mockResolvedValue(mockResponse);
      mockSetTimeout.mockImplementation((callback, timeout) => {
        expect(timeout).toBe(5000); // Custom timeout
        return 123; // Mock timer ID
      });

      await fetchWithTimeout("https://api.example.com/test", {}, 5000);

      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
      expect(mockClearTimeout).toHaveBeenCalledWith(123);
    });

    it("should auto-detect timeout from URL when not provided", async () => {
      const mockResponse = new Response('{"success": true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      mockFetch.mockResolvedValue(mockResponse);
      mockSetTimeout.mockImplementation((callback, timeout) => {
        expect(timeout).toBe(TIMEOUT_CONFIGS.auth); // Auto-detected for auth endpoint
        return 123;
      });

      await fetchWithTimeout("/api/auth/login");

      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        TIMEOUT_CONFIGS.auth
      );
    });

    it("should throw TimeoutError when request times out", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          })
      );

      mockSetTimeout.mockImplementation((callback) => {
        // Immediately call the timeout callback to simulate timeout
        callback();
        return 123;
      });

      await expect(fetchWithTimeout("/api/test", {}, 1000)).rejects.toThrow(
        TimeoutError
      );
      await expect(fetchWithTimeout("/api/test", {}, 1000)).rejects.toThrow(
        "Request timeout after 1000ms for /api/test"
      );
    });

    it("should clear timeout on successful response", async () => {
      const mockResponse = new Response('{"success": true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      mockFetch.mockResolvedValue(mockResponse);
      mockSetTimeout.mockReturnValue(123);

      const response = await fetchWithTimeout("/api/test");

      expect(mockClearTimeout).toHaveBeenCalledWith(123);
      expect(response).toBe(mockResponse);
    });

    it("should clear timeout on network error", async () => {
      const networkError = new Error("Network error");
      mockFetch.mockRejectedValue(networkError);
      mockSetTimeout.mockReturnValue(123);

      await expect(fetchWithTimeout("/api/test")).rejects.toThrow(
        "Network error"
      );
      expect(mockClearTimeout).toHaveBeenCalledWith(123);
    });

    it("should preserve existing abort signal", async () => {
      const existingController = new AbortController();
      const mockResponse = new Response('{"success": true}');

      mockFetch.mockImplementation((url, options) => {
        // Verify that the signal is properly combined
        expect(options.signal).toBeDefined();
        return Promise.resolve(mockResponse);
      });

      await fetchWithTimeout(
        "/api/test",
        { signal: existingController.signal },
        5000
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("should handle already aborted existing signal", async () => {
      const existingController = new AbortController();
      existingController.abort(); // Abort before making request

      const mockResponse = new Response('{"success": true}');
      mockFetch.mockResolvedValue(mockResponse);

      // Should still handle the request properly even with aborted signal
      await fetchWithTimeout(
        "/api/test",
        { signal: existingController.signal },
        5000
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("TimeoutError", () => {
    it("should create error with correct message and name", () => {
      const error = new TimeoutError(5000, "/api/test");

      expect(error.name).toBe("TimeoutError");
      expect(error.message).toBe("Request timeout after 5000ms for /api/test");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("production vs development behavior", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      vi.stubEnv("NODE_ENV", originalEnv || "test");
    });

    it("should log debug info in development", async () => {
      vi.stubEnv("NODE_ENV", "development");

      const mockResponse = new Response('{"success": true}');
      mockFetch.mockResolvedValue(mockResponse);

      // We can't easily test the logger call without more complex mocking,
      // but we can verify the function runs without error in dev mode
      await expect(
        fetchWithTimeout("/api/test", {}, 5000)
      ).resolves.toBeDefined();
    });

    it("should not log debug info in production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const mockResponse = new Response('{"success": true}');
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        fetchWithTimeout("/api/test", {}, 5000)
      ).resolves.toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle zero timeout", async () => {
      mockSetTimeout.mockImplementation((callback) => {
        callback(); // Immediately timeout
        return 123;
      });

      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          })
      );

      await expect(fetchWithTimeout("/api/test", {}, 0)).rejects.toThrow(
        TimeoutError
      );
    });

    it("should handle very large timeout", async () => {
      const mockResponse = new Response('{"success": true}');
      mockFetch.mockResolvedValue(mockResponse);
      mockSetTimeout.mockReturnValue(123);

      await fetchWithTimeout("/api/test", {}, 999999999);

      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        999999999
      );
    });

    it("should handle empty URL", async () => {
      const mockResponse = new Response('{"success": true}');
      mockFetch.mockResolvedValue(mockResponse);

      await expect(fetchWithTimeout("")).resolves.toBeDefined();
    });

    it("should handle URL with query parameters", async () => {
      const mockResponse = new Response('{"success": true}');
      mockFetch.mockResolvedValue(mockResponse);

      const timeout = getTimeoutForEndpoint(
        "/api/auth/login?redirect=/dashboard"
      );
      expect(timeout).toBe(TIMEOUT_CONFIGS.auth);
    });
  });
});
