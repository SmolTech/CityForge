import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
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
});
