import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import {
  createTestRequest,
  assertApiResponse,
  createAuthenticatedRequest,
} from "../../utils/api-test-helpers";
import { createTestUserInDb } from "../../utils/database-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
} from "../setup";
import { clearRateLimitStore } from "@/lib/auth/rateLimit";
import { prisma } from "@/lib/db";
import { generateSecureToken } from "@/lib/email";

describe("Authentication API Routes", () => {
  beforeAll(async () => {
    await setupIntegrationTests();
  }, 60000);

  afterEach(async () => {
    // Clear rate limit store to prevent rate limit issues between tests
    clearRateLimitStore();
    // Clean database after each test to ensure isolation
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  }, 30000);

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      // Create test user with unique email
      const uniqueEmail = `test-${Date.now()}@example.com`;
      await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Test",
        lastName: "User",
        password: "TestPassword123!",
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/login",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
            password: "TestPassword123!",
          },
        }
      );

      const response = await loginRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(uniqueEmail);
        expect(data.user.first_name).toBe("Test");
        expect(data.user.last_name).toBe("User");
        expect(data.access_token).toBeDefined();
      });

      // Check that Set-Cookie header exists for web auth
      expect(response.headers.get("Set-Cookie")).toContain("access_token");
    });

    it("should reject invalid credentials", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/login",
        {
          method: "POST",
          body: {
            email: "nonexistent@example.com",
            password: "wrongpassword",
          },
        }
      );

      const response = await loginRoute(request);

      await assertApiResponse(response, 401, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toBe("Invalid credentials");
      });
    });

    it("should reject invalid email format", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/login",
        {
          method: "POST",
          body: {
            email: "invalid-email",
            password: "password123",
          },
        }
      );

      const response = await loginRoute(request);

      await assertApiResponse(response, 422, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toBe("Validation failed");
      });
    });

    it("should reject inactive user", async () => {
      // Create inactive user with unique email
      const uniqueEmail = `inactive-${Date.now()}@example.com`;
      await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Inactive",
        lastName: "User",
        password: "TestPassword123!",
        isActive: false,
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/login",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
            password: "TestPassword123!",
          },
        }
      );

      const response = await loginRoute(request);

      await assertApiResponse(response, 401, (data) => {
        expect(data.error.message).toBe("Invalid credentials");
      });
    });
  });

  describe("POST /api/auth/register", () => {
    it("should register new user with valid data", async () => {
      const uniqueEmail = `newuser-${Date.now()}@example.com`;
      const request = createTestRequest(
        "http://localhost:3000/api/auth/register",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
            first_name: "New",
            last_name: "User",
            password: "NewPassword123!",
          },
        }
      );

      const response = await registerRoute(request);

      await assertApiResponse(response, 201, (data) => {
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(uniqueEmail);
        expect(data.user.first_name).toBe("New");
        expect(data.user.last_name).toBe("User");
        expect(data.user.role).toBe("user");
        expect(data.access_token).toBeDefined();
      });

      // Check that Set-Cookie header exists
      expect(response.headers.get("Set-Cookie")).toContain("access_token");
    });

    it("should reject duplicate email", async () => {
      // Create existing user with unique email
      const uniqueEmail = `existing-${Date.now()}@example.com`;
      await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Existing",
        lastName: "User",
        password: "ExistingPassword123!",
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/register",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
            first_name: "New",
            last_name: "User",
            password: "NewPassword123!",
          },
        }
      );

      const response = await registerRoute(request);

      await assertApiResponse(response, 409, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toBe("Email already registered");
      });
    });

    it("should reject missing required fields", async () => {
      const uniqueEmail = `newuser-missing-${Date.now()}@example.com`;
      const request = createTestRequest(
        "http://localhost:3000/api/auth/register",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
            password: "NewPassword123!",
            // Missing first_name and last_name
          },
        }
      );

      const response = await registerRoute(request);

      await assertApiResponse(response, 422, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toBe("Validation failed");
        expect(data.error.details).toBeDefined();
        expect(data.error.details.first_name).toContain(
          "First name is required"
        );
        expect(data.error.details.last_name).toContain("Last name is required");
      });
    });
  });

  it("should reject weak password", async () => {
    const uniqueEmail = `newuser-weak-${Date.now()}@example.com`;
    const request = createTestRequest(
      "http://localhost:3000/api/auth/register",
      {
        method: "POST",
        body: {
          email: uniqueEmail,
          first_name: "New",
          last_name: "User",
          password: "weak",
        },
      }
    );

    const response = await registerRoute(request);

    await assertApiResponse(response, 422, (data) => {
      expect(data.error).toBeDefined();
      expect(data.error.message).toBe("Validation failed");
      expect(data.error.details).toBeDefined();
      expect(data.error.details.password).toBeDefined();
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      // Create test user with unique email
      const uniqueEmail = `logout-${Date.now()}@example.com`;
      const user = await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Logout",
        lastName: "User",
        password: "LogoutPassword123!",
      });

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/auth/logout",
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as "admin" | "supporter" | "user",
          isActive: user.isActive ?? true,
          emailVerified: user.emailVerified ?? false,
        },
        {
          method: "POST",
        }
      );

      const response = await logoutRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toBe("Successfully logged out");
      });

      // Check that cookie is cleared
      const setCookie = response.headers.get("Set-Cookie");
      expect(setCookie).toContain("access_token");
      expect(setCookie).toContain("Max-Age=0");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user info for authenticated user", async () => {
      // Create test user with unique email
      const uniqueEmail = `me-test-${Date.now()}@example.com`;
      const user = await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Current",
        lastName: "User",
        password: "CurrentPassword123!",
      });

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/auth/me",
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as "admin" | "supporter" | "user",
          isActive: user.isActive ?? true,
          emailVerified: user.emailVerified ?? false,
        },
        {
          method: "GET",
        }
      );

      const response = await meRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(uniqueEmail);
        expect(data.user.first_name).toBe("Current");
        expect(data.user.last_name).toBe("User");
        expect(data.user.username).toBe("Current User");
        expect(data.user.role).toBe(user.role);
        expect(data.user.is_admin).toBe(user.role === "admin");
        expect(data.user.is_supporter).toBe(
          user.role === "supporter" || user.role === "admin"
        );
        expect(data.user.is_active).toBe(user.isActive ?? true);
        expect(data.user.email_verified).toBe(user.emailVerified ?? false);
      });
    });

    it("should reject unauthenticated request", async () => {
      const request = createTestRequest("http://localhost:3000/api/auth/me", {
        method: "GET",
      });

      const response = await meRoute(request);

      await assertApiResponse(response, 401, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toBe("No authentication token provided");
      });
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should send password reset email for existing user", async () => {
      // Create test user with unique email
      const uniqueEmail = `forgot-${Date.now()}@example.com`;
      const user = await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Forgot",
        lastName: "User",
        password: "ForgotPassword123!",
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
          },
        }
      );

      const response = await forgotPasswordRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toBe(
          "If an account exists with that email, a password reset link has been sent."
        );
      });

      // Verify password reset token was created in database
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      expect(resetToken).toBeDefined();
      expect(resetToken!.token).toBeTruthy();
      expect(resetToken!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should return success for non-existent email (security)", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: {
            email: "nonexistent@example.com",
          },
        }
      );

      const response = await forgotPasswordRoute(request);

      // Should return success to prevent email enumeration
      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toBe(
          "If an account exists with that email, a password reset link has been sent."
        );
      });
    });

    it("should return success for inactive user (security)", async () => {
      // Create inactive user with unique email
      const uniqueEmail = `inactive-forgot-${Date.now()}@example.com`;
      await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Inactive",
        lastName: "User",
        password: "InactivePassword123!",
        isActive: false,
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
          },
        }
      );

      const response = await forgotPasswordRoute(request);

      // Should return success to prevent account enumeration
      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toBe(
          "If an account exists with that email, a password reset link has been sent."
        );
      });
    });

    it("should reject invalid email format", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: {
            email: "invalid-email",
          },
        }
      );

      const response = await forgotPasswordRoute(request);

      // For security, even invalid emails return 200 to prevent enumeration
      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toBe(
          "If an account exists with that email, a password reset link has been sent."
        );
      });
    });

    it("should invalidate existing unused tokens", async () => {
      // Create test user with unique email
      const uniqueEmail = `reset-invalidate-${Date.now()}@example.com`;
      const user = await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Reset",
        lastName: "User",
        password: "ResetPassword123!",
      });

      // Create an existing reset token
      const existingToken = generateSecureToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: existingToken,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        },
      });

      // Request new password reset
      const request = createTestRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
          },
        }
      );

      const response = await forgotPasswordRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toBe(
          "If an account exists with that email, a password reset link has been sent."
        );
      });

      // Verify the old token was marked as used
      const oldToken = await prisma.passwordResetToken.findFirst({
        where: {
          token: existingToken,
        },
      });

      expect(oldToken!.used).toBe(true);
      expect(oldToken!.usedAt).toBeTruthy();

      // Verify a new token was created
      const newToken = await prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      expect(newToken).toBeDefined();
      expect(newToken!.token).not.toBe(existingToken);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("should reset password with valid token", async () => {
      // Create test user with unique email
      const uniqueEmail = `reset-valid-${Date.now()}@example.com`;
      const user = await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Reset",
        lastName: "User",
        password: "OldPassword123!",
      });

      // Create valid reset token
      const resetToken = generateSecureToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        },
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: {
            token: resetToken,
            password: "NewPassword123!",
          },
        }
      );

      const response = await resetPasswordRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toBe(
          "Password has been reset successfully. You can now log in."
        );
      });

      // Verify token was marked as used
      const usedToken = await prisma.passwordResetToken.findFirst({
        where: {
          token: resetToken,
        },
      });

      expect(usedToken!.used).toBe(true);
      expect(usedToken!.usedAt).toBeTruthy();

      // Verify user can login with new password
      const loginRequest = createTestRequest(
        "http://localhost:3000/api/auth/login",
        {
          method: "POST",
          body: {
            email: uniqueEmail,
            password: "NewPassword123!",
          },
        }
      );

      const loginResponse = await loginRoute(loginRequest);
      expect(loginResponse.status).toBe(200);
    });

    it("should reject expired token", async () => {
      // Create test user with unique email
      const uniqueEmail = `reset-expired-${Date.now()}@example.com`;
      const user = await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Reset",
        lastName: "User",
        password: "OldPassword123!",
      });

      // Create expired reset token
      const resetToken = generateSecureToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: {
            token: resetToken,
            password: "NewPassword123!",
          },
        }
      );

      const response = await resetPasswordRoute(request);

      await assertApiResponse(response, 400, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe("TOKEN_EXPIRED");
      });
    });

    it("should reject already used token", async () => {
      // Create test user with unique email
      const uniqueEmail = `reset-used-${Date.now()}@example.com`;
      const user = await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Reset",
        lastName: "User",
        password: "OldPassword123!",
      });

      // Create used reset token
      const resetToken = generateSecureToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
          used: true,
          usedAt: new Date(),
        },
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: {
            token: resetToken,
            password: "NewPassword123!",
          },
        }
      );

      const response = await resetPasswordRoute(request);

      await assertApiResponse(response, 400, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe("TOKEN_ALREADY_USED");
      });
    });

    it("should reject invalid token", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: {
            token: "invalid-token-12345",
            password: "NewPassword123!",
          },
        }
      );

      const response = await resetPasswordRoute(request);

      await assertApiResponse(response, 400, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe("INVALID_TOKEN");
      });
    });

    it("should reject weak password", async () => {
      // Create test user with unique email
      const uniqueEmail = `reset-weak-${Date.now()}@example.com`;
      const user = await createTestUserInDb({
        email: uniqueEmail,
        firstName: "Reset",
        lastName: "User",
        password: "OldPassword123!",
      });

      // Create valid reset token
      const resetToken = generateSecureToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        },
      });

      const request = createTestRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: {
            token: resetToken,
            password: "weak",
          },
        }
      );

      const response = await resetPasswordRoute(request);

      await assertApiResponse(response, 422, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toMatch(/Password must be at least 8/);
      });
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits on login endpoint", async () => {
      const uniqueEmail = `ratelimit-${Date.now()}@example.com`;

      // Make 6 requests (exceeding 5 per minute limit)
      for (let i = 0; i < 6; i++) {
        const request = createTestRequest(
          "http://localhost:3000/api/auth/login",
          {
            method: "POST",
            body: {
              email: uniqueEmail,
              password: "invalid",
            },
          }
        );

        const response = await loginRoute(request);

        if (i < 5) {
          // First 5 should get through (though fail auth)
          expect(response.status).toBe(401);
        } else {
          // 6th should be rate limited
          expect(response.status).toBe(429);
          const data = await response.json();
          expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
        }
      }
    });

    it("should enforce rate limits on registration endpoint", async () => {
      // Make 4 registration requests (exceeding 3 per hour limit)
      for (let i = 0; i < 4; i++) {
        const uniqueEmail = `ratelimit-reg-${Date.now()}-${i}@example.com`;
        const request = createTestRequest(
          "http://localhost:3000/api/auth/register",
          {
            method: "POST",
            body: {
              email: uniqueEmail,
              first_name: "Rate",
              last_name: "Limit",
              password: "RateLimit123!",
            },
          }
        );

        const response = await registerRoute(request);

        if (i < 3) {
          // First 3 should succeed
          expect(response.status).toBe(201);
        } else {
          // 4th should be rate limited
          expect(response.status).toBe(429);
          const data = await response.json();
          expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
        }
      }
    });

    it("should enforce rate limits on forgot password endpoint", async () => {
      // Make 6 forgot password requests (exceeding 5 per hour limit)
      for (let i = 0; i < 6; i++) {
        const request = createTestRequest(
          "http://localhost:3000/api/auth/forgot-password",
          {
            method: "POST",
            body: {
              email: "ratelimit@example.com",
            },
          }
        );

        const response = await forgotPasswordRoute(request);

        if (i < 5) {
          // First 5 should get through
          expect(response.status).toBe(200);
        } else {
          // 6th should be rate limited
          expect(response.status).toBe(429);
          const data = await response.json();
          expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
        }
      }
    });
  });
});
