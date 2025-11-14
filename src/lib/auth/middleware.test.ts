// nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {
  authenticate,
  withAuth,
  withOptionalAuth,
  AuthenticationError,
  AuthorizationError,
  AuthenticatedUser,
} from "./middleware";

// Test-only secret - nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
const TEST_SECRET = "test-secret-key";

// Mock the database client
vi.mock("@/lib/db/client", () => {
  const mockFn = vi.fn();
  return {
    prisma: {
      tokenBlacklist: {
        findUnique: mockFn,
      },
      user: {
        findUnique: mockFn,
      },
    },
  };
});

// Mock the logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/client";

describe("Auth Middleware", () => {
  const originalEnv = process.env;

  // Get mocked prisma methods
  const mockFindUnique = prisma.tokenBlacklist.findUnique as ReturnType<
    typeof vi.fn
  >;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env["JWT_SECRET_KEY"] = TEST_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (options: {
    token?: string;
    useCookie?: boolean;
  }): NextRequest => {
    const { token, useCookie = false } = options;

    const headers = new Headers();
    if (token && !useCookie) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const request = new NextRequest("http://localhost:3000/api/test", {
      headers,
    });

    if (token && useCookie) {
      // Simulate cookie by setting it in the request
      Object.defineProperty(request, "cookies", {
        value: {
          get: (name: string) => {
            if (name === "access_token_cookie") {
              return { value: token };
            }
            return undefined;
          },
        },
        writable: true,
      });
    }

    return request;
  };

  const createValidToken = (
    userId: number,
    jti: string = "test-jti"
  ): string => {
    return jwt.sign(
      {
        sub: userId.toString(),
        jti,
        type: "access",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      TEST_SECRET // nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
    );
  };

  describe("AuthenticationError", () => {
    it("should create authentication error with default status code", () => {
      const error = new AuthenticationError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("AuthenticationError");
    });

    it("should create authentication error with custom status code", () => {
      const error = new AuthenticationError("Test error", 403);

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(403);
    });
  });

  describe("AuthorizationError", () => {
    it("should create authorization error with default status code", () => {
      const error = new AuthorizationError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe("AuthorizationError");
    });

    it("should create authorization error with custom status code", () => {
      const error = new AuthorizationError("Test error", 404);

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(404);
    });
  });

  describe("authenticate", () => {
    const mockUser: AuthenticatedUser = {
      id: 1,
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      role: "user",
      isActive: true,
      emailVerified: true,
      isSupporterFlag: false,
    };

    it("should authenticate user with valid token from Authorization header", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(mockUser); // user lookup

      const user = await authenticate(request);

      expect(user).toEqual(mockUser);
      expect(mockFindUnique).toHaveBeenCalledTimes(2);
    });

    it("should authenticate user with valid token from cookie", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token, useCookie: true });

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(mockUser); // user lookup

      const user = await authenticate(request);

      expect(user).toEqual(mockUser);
    });

    it("should throw error when no token provided", async () => {
      const request = createMockRequest({});

      await expect(authenticate(request)).rejects.toThrow(
        "No authentication token provided"
      );
    });

    it("should return null when no token provided and optional=true", async () => {
      const request = createMockRequest({});

      const user = await authenticate(request, { optional: true });

      expect(user).toBeNull();
    });

    it("should throw error when JWT_SECRET_KEY is not set", async () => {
      delete process.env["JWT_SECRET_KEY"];
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      await expect(authenticate(request)).rejects.toThrow(
        "Authentication failed"
      );
    });

    it("should throw error when token is expired", async () => {
      const expiredToken = jwt.sign(
        {
          sub: "1",
          jti: "test-jti",
          type: "access",
          iat: Math.floor(Date.now() / 1000) - 7200,
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        TEST_SECRET // nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
      );

      const request = createMockRequest({ token: expiredToken });

      await expect(authenticate(request)).rejects.toThrow(AuthenticationError);
    });

    it("should throw error when token is invalid", async () => {
      const request = createMockRequest({ token: "invalid-token" });

      await expect(authenticate(request)).rejects.toThrow(AuthenticationError);
    });

    it("should throw error when token is blacklisted", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      mockFindUnique.mockResolvedValueOnce({ jti: "test-jti" }); // Token is blacklisted

      await expect(authenticate(request)).rejects.toThrow(
        "Token has been revoked"
      );
    });

    it("should throw error when token has no jti", async () => {
      const tokenWithoutJti = jwt.sign(
        {
          sub: "1",
          type: "access",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        TEST_SECRET // nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
      );

      const request = createMockRequest({ token: tokenWithoutJti });

      await expect(authenticate(request)).rejects.toThrow(
        "Invalid token format"
      );
    });

    it("should throw error when user does not exist", async () => {
      const token = createValidToken(999);
      const request = createMockRequest({ token });

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(null); // user not found

      await expect(authenticate(request)).rejects.toThrow(
        "User not found or inactive"
      );
    });

    it("should throw error when user is inactive", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      const inactiveUser = { ...mockUser, isActive: false };

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(inactiveUser); // inactive user

      await expect(authenticate(request)).rejects.toThrow(
        "User not found or inactive"
      );
    });

    it("should authenticate admin user when requireAdmin=true", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      const adminUser = { ...mockUser, role: "admin" as const };

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(adminUser); // admin user

      const user = await authenticate(request, { requireAdmin: true });

      expect(user).toEqual(adminUser);
    });

    it("should throw error when requireAdmin=true but user is not admin", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(mockUser); // regular user

      await expect(
        authenticate(request, { requireAdmin: true })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe("withAuth", () => {
    const mockUser: AuthenticatedUser = {
      id: 1,
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      role: "user",
      isActive: true,
      emailVerified: true,
      isSupporterFlag: false,
    };

    it("should call handler with authenticated user", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(mockUser); // user lookup

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ message: "Success" }));

      const wrappedHandler = withAuth(mockHandler);
      const response = await wrappedHandler(request);

      expect(mockHandler).toHaveBeenCalledWith(request, { user: mockUser });
      expect(response.status).toBe(200);
    });

    it("should return 401 when no token provided", async () => {
      const request = createMockRequest({});

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const response = await wrappedHandler(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error.message).toBe("No authentication token provided");
    });

    it("should return 401 when token is invalid", async () => {
      const request = createMockRequest({ token: "invalid-token" });

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const response = await wrappedHandler(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it("should return 403 when requireAdmin=true but user is not admin", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(mockUser); // regular user

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler, { requireAdmin: true });
      const response = await wrappedHandler(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error.message).toBe("Admin access required");
    });

    it("should return 401 on database errors during auth", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      mockFindUnique.mockRejectedValueOnce(new Error("Database error"));

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const response = await wrappedHandler(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error.message).toBe("Authentication failed");
    });
  });

  describe("withOptionalAuth", () => {
    const mockUser: AuthenticatedUser = {
      id: 1,
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      role: "user",
      isActive: true,
      emailVerified: true,
      isSupporterFlag: false,
    };

    it("should call handler with authenticated user when token is valid", async () => {
      const token = createValidToken(1);
      const request = createMockRequest({ token });

      mockFindUnique
        .mockResolvedValueOnce(null) // tokenBlacklist check
        .mockResolvedValueOnce(mockUser); // user lookup

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ message: "Success" }));

      const wrappedHandler = withOptionalAuth(mockHandler);
      await wrappedHandler(request);

      expect(mockHandler).toHaveBeenCalledWith(request, { user: mockUser });
    });

    it("should call handler with null user when no token provided", async () => {
      const request = createMockRequest({});

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ message: "Success" }));

      const wrappedHandler = withOptionalAuth(mockHandler);
      await wrappedHandler(request);

      expect(mockHandler).toHaveBeenCalledWith(request, { user: null });
    });

    it("should call handler with null user when token is invalid", async () => {
      const request = createMockRequest({ token: "invalid-token" });

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ message: "Success" }));

      const wrappedHandler = withOptionalAuth(mockHandler);
      await wrappedHandler(request);

      expect(mockHandler).toHaveBeenCalledWith(request, { user: null });
    });
  });
});
