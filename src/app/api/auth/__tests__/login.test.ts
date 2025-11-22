import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../login/route";
import {
  createMockRequest,
  createMockUser,
  parseJsonResponse,
} from "../../__tests__/setup";

// Mock dependencies
vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock password utilities
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(),
}));

import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully login with valid credentials", async () => {
    const mockUser = createMockUser({
      email: "test@example.com",
      passwordHash: "$2b$10$validhash",
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "test@example.com",
        password: "correctpassword",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("test@example.com");
    expect(data.user.first_name).toBe("Test");
    expect(data.user.last_name).toBe("User");
    expect(data.access_token).toBeDefined();

    // Verify lastLogin was updated
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: { lastLogin: expect.any(Date) },
    });
  });

  it("should return 401 for non-existent user", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "nonexistent@example.com",
        password: "password",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error.message).toBe("Invalid credentials");
  });

  it("should return 401 for incorrect password", async () => {
    const mockUser = createMockUser({
      email: "test@example.com",
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "test@example.com",
        password: "wrongpassword",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error.message).toBe("Invalid credentials");
  });

  it("should return 401 for inactive user", async () => {
    const mockUser = createMockUser({
      isActive: false,
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "test@example.com",
        password: "password",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error.message).toBe("Invalid credentials");
  });

  it("should allow login with unverified email but log warning", async () => {
    const mockUser = createMockUser({
      emailVerified: false,
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "test@example.com",
        password: "password",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.user.email_verified).toBe(false);
  });

  it("should return 400 for missing email", async () => {
    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        password: "password",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(422);
    expect(data.error.message).toBe("Validation failed");
  });

  it("should return 400 for missing password", async () => {
    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "test@example.com",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(422);
    expect(data.error.message).toBe("Validation failed");
  });

  it("should return 400 for invalid email format", async () => {
    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "not-an-email",
        password: "password",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(422);
    expect(data.error.message).toBe("Validation failed");
  });

  it("should return correct user role flags for admin", async () => {
    const mockUser = createMockUser({
      role: "admin",
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "admin@example.com",
        password: "password",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.user.role).toBe("admin");
    expect(data.user.is_admin).toBe(true);
    expect(data.user.is_supporter).toBe(true);
  });

  it("should return correct user role flags for supporter", async () => {
    const mockUser = createMockUser({
      role: "supporter",
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "supporter@example.com",
        password: "password",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.user.role).toBe("supporter");
    expect(data.user.is_admin).toBe(false);
    expect(data.user.is_supporter).toBe(true);
  });

  it("should set httpOnly cookie in response", async () => {
    const mockUser = createMockUser();

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/login",
      body: {
        email: "test@example.com",
        password: "password",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Check that Set-Cookie header is present
    const setCookieHeader = response.headers.get("Set-Cookie");
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain("access_token_cookie");
    expect(setCookieHeader).toContain("HttpOnly");
  });
});
