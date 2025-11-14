import { describe, it, expect } from "vitest";
import {
  createTestRequest,
  createTestToken,
  createTestUser,
  createTestAdmin,
} from "./api-test-helpers";

describe("API Test Helpers", () => {
  describe("createTestRequest", () => {
    it("should create a basic GET request", () => {
      const request = createTestRequest("http://localhost:3000/api/test");

      expect(request.url).toBe("http://localhost:3000/api/test");
      expect(request.method).toBe("GET");
      expect(request.headers.get("Content-Type")).toBe("application/json");
    });

    it("should create a POST request with body", () => {
      const request = createTestRequest("http://localhost:3000/api/test", {
        method: "POST",
        body: { test: "data" },
      });

      expect(request.method).toBe("POST");
      expect(request.headers.get("Content-Type")).toBe("application/json");
    });

    it("should add cookies to headers", () => {
      const request = createTestRequest("http://localhost:3000/api/test", {
        cookies: { session: "abc123", csrf: "token456" },
      });

      const cookieHeader = request.headers.get("Cookie");
      expect(cookieHeader).toContain("session=abc123");
      expect(cookieHeader).toContain("csrf=token456");
    });
  });

  describe("createTestToken", () => {
    it("should create a valid JWT token", () => {
      const user = createTestUser();
      const token = createTestToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe("createTestUser", () => {
    it("should create a test user with default values", () => {
      const user = createTestUser();

      expect(user.id).toBe(1);
      expect(user.email).toBe("test@example.com");
      expect(user.firstName).toBe("Test");
      expect(user.lastName).toBe("User");
      expect(user.role).toBe("user");
      expect(user.isActive).toBe(true);
      expect(user.emailVerified).toBe(true);
    });

    it("should allow overriding user properties", () => {
      const user = createTestUser({
        id: 42,
        email: "custom@example.com",
        role: "admin",
      });

      expect(user.id).toBe(42);
      expect(user.email).toBe("custom@example.com");
      expect(user.role).toBe("admin");
      expect(user.firstName).toBe("Test"); // unchanged
    });
  });

  describe("createTestAdmin", () => {
    it("should create an admin user", () => {
      const admin = createTestAdmin();

      expect(admin.role).toBe("admin");
      expect(admin.email).toBe("admin@example.com");
      expect(admin.firstName).toBe("Admin");
      expect(admin.lastName).toBe("User");
    });
  });
});
