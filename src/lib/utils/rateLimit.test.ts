import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, createRateLimitResponse } from "./rateLimit";

describe("rateLimit utilities", () => {
  // Mock Date.now for consistent testing
  const mockDate = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkRateLimit", () => {
    test("should allow first request", () => {
      const result = checkRateLimit(1, "test-action", 5);
      expect(result).toBe(true);
    });

    test("should allow requests within limit", () => {
      expect(checkRateLimit(1, "test-action-within", 5)).toBe(true);
      expect(checkRateLimit(1, "test-action-within", 5)).toBe(true);
      expect(checkRateLimit(1, "test-action-within", 5)).toBe(true);
      expect(checkRateLimit(1, "test-action-within", 5)).toBe(true);
      expect(checkRateLimit(1, "test-action-within", 5)).toBe(true);
    });

    test("should deny requests when limit exceeded", () => {
      const userId = 2;
      const action = "test-exceed";

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit(userId, action, 5)).toBe(true);
      }
      // Next request should be denied
      expect(checkRateLimit(userId, action, 5)).toBe(false);
      expect(checkRateLimit(userId, action, 5)).toBe(false);
    });

    test("should reset after one hour", () => {
      const userId = 3;
      const action = "test-reset";

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        checkRateLimit(userId, action, 5);
      }
      expect(checkRateLimit(userId, action, 5)).toBe(false);

      // Advance time by one hour
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Should allow requests again
      expect(checkRateLimit(userId, action, 5)).toBe(true);
    });

    test("should handle different users independently", () => {
      const action = "test-users";

      // Use up limit for user 4
      for (let i = 0; i < 5; i++) {
        checkRateLimit(4, action, 5);
      }
      expect(checkRateLimit(4, action, 5)).toBe(false);

      // User 5 should still have full limit
      expect(checkRateLimit(5, action, 5)).toBe(true);
    });

    test("should handle different limit keys independently", () => {
      const userId = 6;

      // Use up limit for one action type
      for (let i = 0; i < 5; i++) {
        checkRateLimit(userId, "action-1", 5);
      }
      expect(checkRateLimit(userId, "action-1", 5)).toBe(false);

      // Different action should still have full limit
      expect(checkRateLimit(userId, "action-2", 5)).toBe(true);
    });

    test("should handle different limit values", () => {
      // Test with limit of 1
      expect(checkRateLimit(7, "limited-action", 1)).toBe(true);
      expect(checkRateLimit(7, "limited-action", 1)).toBe(false);

      // Test with limit of 10
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit(8, "generous-action", 10)).toBe(true);
      }
      expect(checkRateLimit(8, "generous-action", 10)).toBe(false);
    });

    test("should handle edge case of zero limit", () => {
      // First call should succeed (sets count to 1)
      expect(checkRateLimit(9, "no-action", 0)).toBe(true);
      // Second call should fail (1 >= 0)
      expect(checkRateLimit(9, "no-action", 0)).toBe(false);
    });

    test("should handle very large user IDs", () => {
      const largeUserId = 999999999;
      expect(checkRateLimit(largeUserId, "test-action", 5)).toBe(true);
    });
  });

  describe("createRateLimitResponse", () => {
    test("should create proper error response structure", () => {
      const response = createRateLimitResponse("5 posts per hour");

      expect(response).toEqual({
        error: {
          message: "Rate limit exceeded. Please try again later.",
          code: 429,
          details: {
            description: "5 posts per hour",
          },
        },
      });
    });

    test("should handle empty description", () => {
      const response = createRateLimitResponse("");

      expect(response.error.details.description).toBe("");
      expect(response.error.code).toBe(429);
    });

    test("should handle long descriptions", () => {
      const longDescription = "A very long description ".repeat(10);
      const response = createRateLimitResponse(longDescription);

      expect(response.error.details.description).toBe(longDescription);
    });

    test("should always return 429 status code", () => {
      const response1 = createRateLimitResponse("test");
      const response2 = createRateLimitResponse("another test");

      expect(response1.error.code).toBe(429);
      expect(response2.error.code).toBe(429);
    });
  });
});
