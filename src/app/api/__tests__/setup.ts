/**
 * Test setup utilities for API route testing
 */

import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { vi } from "vitest";

const TEST_SECRET = process.env["JWT_SECRET_KEY"] || "test-secret-key";

/**
 * Create a mock NextRequest for testing API routes
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
  useCookie?: boolean;
}): NextRequest {
  const {
    method = "GET",
    url = "http://localhost:3000/api/test",
    body,
    headers = {},
    token,
    useCookie = false,
  } = options;

  const requestHeaders = new Headers(headers);

  // Add Authorization header if token provided
  if (token && !useCookie) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const requestInit: {
    method: string;
    headers: Headers;
    body?: string;
  } = {
    method,
    headers: requestHeaders,
  };

  // Add body for POST/PUT/PATCH requests
  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    requestInit.body = JSON.stringify(body);
    requestHeaders.set("Content-Type", "application/json");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = new NextRequest(url, requestInit as any);

  // Mock cookies if needed
  if (token && useCookie) {
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
}

/**
 * Create a valid JWT token for testing
 */
export function createTestToken(
  userId: number,
  options: {
    jti?: string;
    expired?: boolean;
  } = {}
): string {
  const { jti = `test-jti-${userId}`, expired = false } = options;

  const now = Math.floor(Date.now() / 1000);
  const exp = expired ? now - 3600 : now + 3600;

  return jwt.sign(
    {
      sub: userId.toString(),
      jti,
      type: "access",
      iat: now,
      exp,
    },
    TEST_SECRET
  );
}

/**
 * Mock Prisma database for testing
 */
export function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tokenBlacklist: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    card: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

/**
 * Mock user object for testing
 */
export function createMockUser(
  overrides: Partial<{
    id: number;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: "admin" | "supporter" | "user";
    isActive: boolean;
    emailVerified: boolean;
    isSupporterFlag: boolean;
    support: boolean;
    createdDate: Date;
    lastLogin: Date;
    registrationIpAddress: string;
  }> = {}
) {
  return {
    id: 1,
    email: "test@example.com",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuv", // Fake bcrypt hash
    firstName: "Test",
    lastName: "User",
    role: "user" as const,
    isActive: true,
    emailVerified: true,
    isSupporterFlag: false,
    support: false,
    createdDate: new Date(),
    lastLogin: new Date(),
    registrationIpAddress: null,
    ...overrides,
  };
}

/**
 * Parse JSON response from NextResponse
 */
export async function parseJsonResponse(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
