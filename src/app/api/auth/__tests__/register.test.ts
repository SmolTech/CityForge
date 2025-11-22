import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../register/route";
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
      create: vi.fn(),
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

vi.mock("@/lib/auth/email-verification", () => ({
  createEmailVerificationToken: vi.fn().mockResolvedValue("mock-token"),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock password utilities
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
}));

import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully register a new user", async () => {
    const mockUser = createMockUser({
      id: 1,
      email: "newuser@example.com",
      firstName: "New",
      lastName: "User",
      emailVerified: false,
      role: "user",
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(hashPassword).mockResolvedValue("$2b$10$hashedpassword");

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "newuser@example.com",
        password: "SecurePass123!",
        first_name: "New",
        last_name: "User",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(201);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("newuser@example.com");
    expect(data.user.first_name).toBe("New");
    expect(data.user.last_name).toBe("User");
    expect(data.user.role).toBe("user");
    expect(data.user.is_admin).toBe(false);
    expect(data.user.is_supporter).toBe(false);
    expect(data.user.is_active).toBe(true);
    expect(data.access_token).toBeDefined();
    expect(data.message).toContain("verify your account");

    // Verify user was created with correct data
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "newuser@example.com",
        passwordHash: "$2b$10$hashedpassword",
        firstName: "New",
        lastName: "User",
        role: "user",
        isActive: true,
        emailVerified: false,
        createdDate: expect.any(Date),
      },
      select: expect.any(Object),
    });
  });

  it("should return 409 for existing email", async () => {
    const existingUser = createMockUser({
      email: "existing@example.com",
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      existingUser
    );

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "existing@example.com",
        password: "Password123",
        first_name: "Test",
        last_name: "User",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(409);
    expect(data.error.message).toBe("Email already registered");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("should return 400 for missing email", async () => {
    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        password: "Password123",
        first_name: "Test",
        last_name: "User",
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
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "not-an-email",
        password: "Password123",
        first_name: "Test",
        last_name: "User",
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
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(422);
    expect(data.error.message).toBe("Validation failed");
  });

  it("should return 400 for missing first_name", async () => {
    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "test@example.com",
        password: "Password123",
        last_name: "User",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(422);
    expect(data.error.message).toBe("Validation failed");
  });

  it("should return 400 for missing last_name", async () => {
    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "test@example.com",
        password: "Password123",
        first_name: "Test",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(422);
    expect(data.error.message).toBe("Validation failed");
  });

  it("should hash password before storing", async () => {
    const mockUser = createMockUser({
      emailVerified: false,
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(hashPassword).mockResolvedValue("$2b$10$hashedpassword");

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "test@example.com",
        password: "PlainTextPassword123!",
        first_name: "Test",
        last_name: "User",
      },
    });

    await POST(request);

    // Verify password was hashed
    expect(hashPassword).toHaveBeenCalledWith("PlainTextPassword123!");

    // Verify hashed password was used in create
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        passwordHash: "$2b$10$hashedpassword",
      }),
      select: expect.any(Object),
    });
  });

  it("should set httpOnly cookie in response", async () => {
    const mockUser = createMockUser({
      emailVerified: false,
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(hashPassword).mockResolvedValue("$2b$10$hashedpassword");

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "test@example.com",
        password: "Password123",
        first_name: "Test",
        last_name: "User",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(201);

    // Check that Set-Cookie header is present
    const setCookieHeader = response.headers.get("Set-Cookie");
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain("access_token_cookie");
    expect(setCookieHeader).toContain("HttpOnly");
  });

  it("should not fail registration if email sending fails", async () => {
    const mockUser = createMockUser({
      emailVerified: false,
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(hashPassword).mockResolvedValue("$2b$10$hashedpassword");

    // Mock email sending to fail
    const emailVerification = await import("@/lib/auth/email-verification");
    vi.mocked(emailVerification.sendVerificationEmail).mockRejectedValue(
      new Error("Email service unavailable")
    );

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "test@example.com",
        password: "Password123",
        first_name: "Test",
        last_name: "User",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    // Registration should still succeed
    expect(response.status).toBe(201);
    expect(data.user).toBeDefined();
    expect(data.access_token).toBeDefined();
  });

  it("should create user with default role of 'user'", async () => {
    const mockUser = createMockUser({
      role: "user",
      emailVerified: false,
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser
    );
    vi.mocked(hashPassword).mockResolvedValue("$2b$10$hashedpassword");

    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/register",
      body: {
        email: "test@example.com",
        password: "Password123",
        first_name: "Test",
        last_name: "User",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(201);
    expect(data.user.role).toBe("user");
    expect(data.user.is_admin).toBe(false);
    expect(data.user.is_supporter).toBe(false);

    // Verify database call
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "user",
        isActive: true,
        emailVerified: false,
      }),
      select: expect.any(Object),
    });
  });
});
