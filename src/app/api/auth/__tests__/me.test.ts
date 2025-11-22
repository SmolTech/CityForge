import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../me/route";
import {
  createMockRequest,
  createTestToken,
  createMockUser,
  parseJsonResponse,
} from "../../__tests__/setup";

// Mock dependencies
vi.mock("@/lib/db/client", () => ({
  prisma: {
    tokenBlacklist: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/client";

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return user info for authenticated user", async () => {
    const mockUser = createMockUser({
      id: 1,
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      role: "user",
    });

    const token = createTestToken(mockUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(1);
    expect(data.user.email).toBe("test@example.com");
    expect(data.user.first_name).toBe("Test");
    expect(data.user.last_name).toBe("User");
    expect(data.user.username).toBe("Test User");
    expect(data.user.role).toBe("user");
    expect(data.user.is_admin).toBe(false);
    expect(data.user.is_supporter).toBe(false);
    expect(data.user.is_active).toBe(true);
    expect(data.user.email_verified).toBe(true);
  });

  it("should return correct flags for admin user", async () => {
    const mockUser = createMockUser({
      id: 1,
      role: "admin",
    });

    const token = createTestToken(mockUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.user.role).toBe("admin");
    expect(data.user.is_admin).toBe(true);
    expect(data.user.is_supporter).toBe(true);
  });

  it("should return correct flags for supporter user", async () => {
    const mockUser = createMockUser({
      id: 1,
      role: "supporter",
    });

    const token = createTestToken(mockUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.user.role).toBe("supporter");
    expect(data.user.is_admin).toBe(false);
    expect(data.user.is_supporter).toBe(true);
  });

  it("should return 401 when no token provided", async () => {
    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
    expect(data.error.message).toBe("No authentication token provided");
  });

  it("should return 401 for expired token", async () => {
    const token = createTestToken(1, { expired: true });

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("should return 401 for invalid token", async () => {
    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token: "invalid-token",
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("should return 401 for blacklisted token", async () => {
    const mockUser = createMockUser();
    const token = createTestToken(mockUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      jti: "test-jti-1",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    });

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error.message).toBe("Token has been revoked");
  });

  it("should return 401 when user not found", async () => {
    const token = createTestToken(999);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error.message).toBe("User not found or inactive");
  });

  it("should return 401 when user is inactive", async () => {
    const mockUser = createMockUser({
      isActive: false,
    });
    const token = createTestToken(mockUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error.message).toBe("User not found or inactive");
  });

  it("should accept token from Authorization header", async () => {
    const mockUser = createMockUser();
    const token = createTestToken(mockUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
      useCookie: false,
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("should accept token from cookie", async () => {
    const mockUser = createMockUser();
    const token = createTestToken(mockUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/auth/me",
      token,
      useCookie: true,
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
