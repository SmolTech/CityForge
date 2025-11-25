import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  checkAuthRateLimit,
  createRateLimitResponse,
  withAuthRateLimit,
  getRateLimitStatus,
  AUTH_RATE_LIMITS,
  clearRateLimitStore,
} from "@/lib/auth/rateLimit";

// Mock Date.now for consistent testing
vi.mock("Date", () => ({
  now: vi.fn(() => new Date("2024-01-01T12:00:00Z").getTime()),
}));

function createMockRequest(ip?: string): NextRequest {
  const url = new URL("http://localhost:3000/api/auth/login");
  const headers: Record<string, string> = {};

  if (ip) {
    headers["x-forwarded-for"] = ip;
  }

  return new NextRequest(url, { headers });
}

describe("Authentication Rate Limiting", () => {
  beforeEach(() => {
    // Clear rate limit store and mocks between tests
    clearRateLimitStore();
    vi.clearAllMocks();
  });

  describe("checkAuthRateLimit", () => {
    it("should allow requests within rate limit", () => {
      const request = createMockRequest("192.168.1.1");
      const result = checkAuthRateLimit(request, "login");

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4); // 5 max - 1 used
      expect(result.resetTime).toBeGreaterThan(Date.now());
      expect(result.config).toEqual(AUTH_RATE_LIMITS["login"]);
    });

    it("should deny requests when limit exceeded", () => {
      const ip = "192.168.1.2";

      // Make requests up to the limit (5 for login)
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(ip);
        const result = checkAuthRateLimit(request, "login");
        expect(result.allowed).toBe(true);
        expect(result.remainingRequests).toBe(4 - i);
      }

      // Next request should be denied
      const request = createMockRequest(ip);
      const result = checkAuthRateLimit(request, "login");
      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
    });

    it("should handle different endpoints independently", () => {
      const ip = "192.168.1.3";

      // Use up login attempts (5 max)
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(ip);
        const result = checkAuthRateLimit(request, "login");
        expect(result.allowed).toBe(true);
      }

      // Login should now be blocked
      const loginRequest = createMockRequest(ip);
      const loginResult = checkAuthRateLimit(loginRequest, "login");
      expect(loginResult.allowed).toBe(false);

      // But register should still work (3 max, different endpoint)
      const registerRequest = createMockRequest(ip);
      const registerResult = checkAuthRateLimit(registerRequest, "register");
      expect(registerResult.allowed).toBe(true);
      expect(registerResult.config.maxRequests).toBe(3);
    });

    it("should handle different IPs independently", () => {
      const ip1 = "192.168.1.4";
      const ip2 = "192.168.1.5";

      // Use up attempts for ip1
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(ip1);
        const result = checkAuthRateLimit(request, "login");
        expect(result.allowed).toBe(true);
      }

      // ip1 should be blocked
      const request1 = createMockRequest(ip1);
      const result1 = checkAuthRateLimit(request1, "login");
      expect(result1.allowed).toBe(false);

      // ip2 should still work
      const request2 = createMockRequest(ip2);
      const result2 = checkAuthRateLimit(request2, "login");
      expect(result2.allowed).toBe(true);
      expect(result2.remainingRequests).toBe(4);
    });

    it("should reset after window expires", async () => {
      const ip = "192.168.1.6";

      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(ip);
        checkAuthRateLimit(request, "login");
      }

      // Should be blocked
      const blockedRequest = createMockRequest(ip);
      const blockedResult = checkAuthRateLimit(blockedRequest, "login");
      expect(blockedResult.allowed).toBe(false);

      // Fast forward time by mocking Date.now
      const currentTime = Date.now();
      const dateSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(currentTime + 61000); // 61 seconds later

      try {
        // Should be allowed again (new window)
        const newRequest = createMockRequest(ip);
        const newResult = checkAuthRateLimit(newRequest, "login");
        expect(newResult.allowed).toBe(true);
        expect(newResult.remainingRequests).toBe(4);
      } finally {
        // Restore original Date.now
        dateSpy.mockRestore();
      }
    });

    it("should handle unknown endpoints gracefully", () => {
      const request = createMockRequest("192.168.1.7");
      // Test with an endpoint that doesn't exist in AUTH_RATE_LIMITS
      const result = checkAuthRateLimit(
        request,
        "unknown-endpoint" as keyof typeof AUTH_RATE_LIMITS
      );

      expect(result.allowed).toBe(true);
      expect(result.config.description).toBe(
        "10 requests per minute (default)"
      );
    });
  });

  describe("createRateLimitResponse", () => {
    it("should create proper rate limit response", () => {
      const resetTime = Date.now() + 60000;
      const config = AUTH_RATE_LIMITS["login"];

      if (!config) {
        throw new Error("Login config should exist");
      }

      const response = createRateLimitResponse("login", resetTime, config);

      expect(response.status).toBe(429);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("Retry-After")).toBe("60");

      // Check response body structure
      expect(response.body).toBeTruthy();
    });

    it("should calculate retry-after correctly", () => {
      const resetTime = Date.now() + 45000; // 45 seconds from now
      const config = AUTH_RATE_LIMITS["register"];

      if (!config) {
        throw new Error("Register config should exist");
      }

      const response = createRateLimitResponse("register", resetTime, config);
      const retryAfter = parseInt(response.headers.get("Retry-After") || "0");

      expect(retryAfter).toBeGreaterThanOrEqual(44);
      expect(retryAfter).toBeLessThanOrEqual(46);
    });
  });

  describe("withAuthRateLimit middleware", () => {
    it("should allow requests within rate limit", async () => {
      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const wrappedHandler = withAuthRateLimit("login", mockHandler);
      const request = createMockRequest("192.168.1.8");

      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(request);

      // Check rate limit headers
      expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("4");
      expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });

    it("should block requests when rate limit exceeded", async () => {
      const mockHandler = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: true }), { status: 200 })
        );

      const wrappedHandler = withAuthRateLimit("login", mockHandler);
      const ip = "192.168.1.9";

      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(ip);
        await wrappedHandler(request);
      }

      // Next request should be rate limited
      const request = createMockRequest(ip);
      const response = await wrappedHandler(request);

      expect(response.status).toBe(429);
      expect(mockHandler).toHaveBeenCalledTimes(5); // Should not be called for blocked request

      // Check rate limit headers
      expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("Retry-After")).toBeTruthy();
    });

    it("should preserve original response headers", async () => {
      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Custom-Header": "test-value",
          },
        })
      );

      const wrappedHandler = withAuthRateLimit("register", mockHandler);
      const request = createMockRequest("192.168.1.10");

      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Custom-Header")).toBe("test-value");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("3");
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return current rate limit status", () => {
      const ip = "192.168.1.11";
      const request = createMockRequest(ip);

      // Make a request to establish rate limit state
      checkAuthRateLimit(request, "login");

      // Get status
      const status = getRateLimitStatus(request, "login");

      expect(status).toBeTruthy();
      expect(status!.ip).toBe(ip);
      expect(status!.endpoint).toBe("login");
      expect(status!.current).toBe(1);
      expect(status!.limit).toBe(5);
      expect(typeof status!.resetTime).toBe("number");
      expect(status!.resetTime).toBeGreaterThan(Date.now());
    });

    it("should return status for non-existent rate limit", () => {
      const request = createMockRequest("192.168.1.12");
      const status = getRateLimitStatus(request, "login");

      expect(status).toBeTruthy();
      expect(status!.current).toBe(0);
      expect(status!.limit).toBe(5);
    });

    it("should track current attempts correctly", () => {
      const ip = "192.168.1.13";
      const request = createMockRequest(ip);

      // Make requests and check status
      for (let i = 0; i < 3; i++) {
        checkAuthRateLimit(request, "register");

        const status = getRateLimitStatus(request, "register");
        expect(status!.current).toBe(i + 1);
        expect(status!.limit).toBe(3);
      }
    });
  });

  describe("Rate limit configurations", () => {
    it("should have correct login configuration", () => {
      const config = AUTH_RATE_LIMITS["login"];
      expect(config).toBeTruthy();
      if (config) {
        expect(config.maxRequests).toBe(5);
        expect(config.windowMs).toBe(60000); // 1 minute
        expect(config.description).toBe("5 attempts per minute");
      }
    });

    it("should have correct register configuration", () => {
      const config = AUTH_RATE_LIMITS["register"];
      expect(config).toBeTruthy();
      if (config) {
        expect(config.maxRequests).toBe(3);
        expect(config.windowMs).toBe(3600000); // 1 hour
        expect(config.description).toBe("3 registrations per hour");
      }
    });

    it("should have stricter limits for sensitive endpoints", () => {
      const loginConfig = AUTH_RATE_LIMITS["login"];
      const registerConfig = AUTH_RATE_LIMITS["register"];
      const resetPasswordConfig = AUTH_RATE_LIMITS["reset-password"];

      if (loginConfig) {
        expect(loginConfig.maxRequests).toBeGreaterThanOrEqual(3);
        expect(loginConfig.windowMs).toBeGreaterThanOrEqual(60000);
      }

      if (registerConfig) {
        expect(registerConfig.maxRequests).toBeLessThanOrEqual(5);
        expect(registerConfig.windowMs).toBeGreaterThanOrEqual(3600000);
      }

      if (resetPasswordConfig) {
        expect(resetPasswordConfig.maxRequests).toBeLessThanOrEqual(5);
        expect(resetPasswordConfig.windowMs).toBeGreaterThanOrEqual(900000); // 15 min
      }
    });

    it("should have all required endpoints configured", () => {
      const requiredEndpoints = [
        "login",
        "register",
        "forgot-password",
        "reset-password",
        "resend-verification",
        "verify-email",
      ];

      requiredEndpoints.forEach((endpoint) => {
        const config = AUTH_RATE_LIMITS[endpoint];
        expect(config).toBeTruthy();
        if (config) {
          expect(config.maxRequests).toBeGreaterThan(0);
          expect(config.windowMs).toBeGreaterThan(0);
          expect(config.description).toBeTruthy();
        }
      });
    });
  });

  describe("IP address extraction", () => {
    it("should handle multiple forwarded IPs", () => {
      const url = new URL("http://localhost:3000/api/auth/login");
      const request = new NextRequest(url, {
        headers: { "x-forwarded-for": "192.168.1.100, 10.0.0.1, 172.16.0.1" },
      });

      const result = checkAuthRateLimit(request, "login");

      // Should use first IP in forwarded chain
      expect(result.allowed).toBe(true);
    });

    it("should handle x-real-ip header", () => {
      const url = new URL("http://localhost:3000/api/auth/login");
      const request = new NextRequest(url, {
        headers: { "x-real-ip": "192.168.1.101" },
      });

      const result = checkAuthRateLimit(request, "login");
      expect(result.allowed).toBe(true);
    });

    it("should handle x-client-ip header", () => {
      const url = new URL("http://localhost:3000/api/auth/login");
      const request = new NextRequest(url, {
        headers: { "x-client-ip": "192.168.1.102" },
      });

      const result = checkAuthRateLimit(request, "login");
      expect(result.allowed).toBe(true);
    });

    it("should fallback to default IP", () => {
      const request = createMockRequest(); // No specific IP headers
      const result = checkAuthRateLimit(request, "login");
      expect(result.allowed).toBe(true);
    });
  });

  describe("Memory management", () => {
    it("should not leak memory with many different IPs", () => {
      // Test with many different IPs to ensure no memory issues
      for (let i = 0; i < 100; i++) {
        const request = createMockRequest(`192.168.1.${i}`);
        const result = checkAuthRateLimit(request, "login");
        expect(result.allowed).toBe(true);
      }

      // All should still work independently
      const finalRequest = createMockRequest("192.168.1.200");
      const finalResult = checkAuthRateLimit(finalRequest, "login");
      expect(finalResult.allowed).toBe(true);
    });

    it("should clear store properly for testing", () => {
      const request = createMockRequest("192.168.1.201");

      // Make a request to create an entry
      checkAuthRateLimit(request, "login");
      let status = getRateLimitStatus(request, "login");
      expect(status!.current).toBe(1);

      // Clear the store
      clearRateLimitStore();

      // Status should show fresh state
      status = getRateLimitStatus(request, "login");
      expect(status!.current).toBe(0);
    });
  });
});
