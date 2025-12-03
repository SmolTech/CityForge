import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
} from "vitest";
import { POST as uploadRoute } from "@/app/api/upload/route";
import { POST as createReviewRoute } from "@/app/api/cards/[id]/reviews/route";
import {
  createTestRequest,
  createAuthenticatedRequest,
} from "../../utils/api-test-helpers";
import { createTestUserInDb } from "../../utils/database-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
} from "../setup";
import { generateCsrfToken } from "@/lib/auth/csrf";

describe("CSRF Protection Integration Tests", () => {
  let testUser: { id: number; email: string };

  beforeAll(async () => {
    await setupIntegrationTests();
  }, 60000);

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  }, 30000);

  describe("Upload endpoint CSRF protection", () => {
    beforeEach(async () => {
      // Create test user
      testUser = await createTestUserInDb({
        email: `test-${Date.now()}@example.com`,
        firstName: "Test",
        lastName: "User",
        password: "TestPassword123!",
      });
    });

    it("should reject POST /api/upload without CSRF token", async () => {
      // Create request with minimal valid structure but no CSRF token
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/upload",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: "Test",
          lastName: "User",
          role: "user",
        },
        {
          method: "POST",
          body: JSON.stringify({ test: "data" }), // Use JSON instead of FormData for simplicity
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await uploadRoute(request);

      console.log("Upload response status:", response.status);
      console.log("Upload response body:", await response.clone().text());

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error.code).toBe("CSRF_TOKEN_INVALID");
      expect(data.error.message).toBe("CSRF token validation failed");
    });

    it("should accept POST /api/upload with valid CSRF token", async () => {
      const csrfToken = generateCsrfToken();

      // Create a simple form data for upload test
      const formData = new FormData();
      const testFile = new Blob(["test content"], { type: "image/png" });
      formData.append("file", testFile, "test.png");

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/upload",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: "Test",
          lastName: "User",
          role: "user",
        },
        {
          method: "POST",
          body: formData,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          cookies: {
            csrf_token: csrfToken,
          },
        }
      );

      const response = await uploadRoute(request);

      // Should proceed to the actual upload logic (may fail due to file handling, but not due to CSRF)
      // If it fails, it should not be a 403 CSRF error
      if (response.status !== 200) {
        const data = await response.json();
        // Should not be a CSRF error
        expect(data.error?.code).not.toBe("CSRF_TOKEN_INVALID");
      }
    });

    it("should exempt requests with Bearer token from CSRF validation", async () => {
      // Create a simple form data for upload test
      const formData = new FormData();
      const testFile = new Blob(["test content"], { type: "image/png" });
      formData.append("file", testFile, "test.png");

      const request = createTestRequest("http://localhost:3000/api/upload", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: "Bearer some-mobile-token",
        },
      });

      const response = await uploadRoute(request);

      // Should proceed to the actual upload logic (may fail due to auth, but not due to CSRF)
      // If it fails, it should not be a 403 CSRF error
      const data = await response.json();

      // Should not be a CSRF error - might be auth error or file handling error
      if (data.error) {
        expect(data.error.code).not.toBe("CSRF_TOKEN_INVALID");
      }
    });
  });

  describe("Review endpoint CSRF protection", () => {
    beforeEach(async () => {
      // Create test user
      testUser = await createTestUserInDb({
        email: `test-${Date.now()}@example.com`,
        firstName: "Test",
        lastName: "User",
        password: "TestPassword123!",
      });
    });

    it("should reject POST /api/cards/[id]/reviews without CSRF token", async () => {
      const reviewData = {
        rating: 5,
        title: "Great business!",
        comment: "Really enjoyed the service.",
      };

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/cards/999/reviews", // Using non-existent card ID for simplicity
        {
          id: testUser.id,
          email: testUser.email,
          firstName: "Test",
          lastName: "User",
          role: "user",
        },
        {
          method: "POST",
          body: reviewData,
          // Explicitly omit CSRF token
          headers: {},
        }
      );

      const response = await createReviewRoute(request, {
        params: Promise.resolve({ id: "999" }),
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error.code).toBe("CSRF_TOKEN_INVALID");
      expect(data.error.message).toBe("CSRF token validation failed");
    });

    it("should process POST /api/cards/[id]/reviews with valid CSRF token", async () => {
      const csrfToken = generateCsrfToken();
      const reviewData = {
        rating: 5,
        title: "Great business!",
        comment: "Really enjoyed the service.",
      };

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/cards/999/reviews", // Using non-existent card ID for simplicity
        {
          id: testUser.id,
          email: testUser.email,
          firstName: "Test",
          lastName: "User",
          role: "user",
        },
        {
          method: "POST",
          body: reviewData,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          cookies: {
            csrf_token: csrfToken,
          },
        }
      );

      const response = await createReviewRoute(request, {
        params: Promise.resolve({ id: "999" }),
      });

      // Should proceed to actual review logic (may fail due to non-existent card, but not due to CSRF)
      if (response.status !== 201) {
        const data = await response.json();
        // Should not be a CSRF error
        expect(data.error?.code).not.toBe("CSRF_TOKEN_INVALID");
      }
    });
  });
});
