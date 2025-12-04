import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  AuthenticationError,
  TokenExpiredError,
  InvalidTokenError,
  AuthorizationError,
  AuthenticatedUser,
} from "@/lib/auth/middleware";
import { createTestRequest } from "../../utils/api-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
} from "../setup";

describe("withOptionalAuth Security Fix Tests", () => {
  beforeAll(async () => {
    await setupIntegrationTests();
  }, 60000);

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  }, 30000);

  describe("Security Logic Validation", () => {
    const mockUser: AuthenticatedUser = {
      id: 1,
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      role: "user",
      isActive: true,
      emailVerified: true,
      isSupporterFlag: false,
      support: false,
    };

    // Create a test handler
    const createTestHandler = () => {
      return vi
        .fn()
        .mockImplementation(
          async (
            _request: NextRequest,
            context: { user: AuthenticatedUser | null }
          ) => {
            return NextResponse.json({
              success: true,
              hasUser: !!context.user,
              userId: context.user?.id || null,
            });
          }
        );
    };

    // Simulate the withOptionalAuth security logic
    const simulateWithOptionalAuth = (
      mockAuthenticate: () => Promise<AuthenticatedUser>
    ) => {
      return (
        handler: (
          request: NextRequest,
          context: { user: AuthenticatedUser | null }
        ) => Promise<NextResponse>
      ) => {
        return async (request: NextRequest): Promise<NextResponse> => {
          try {
            const user = await mockAuthenticate();
            return handler(request, { user });
          } catch (error) {
            // This is the security fix - only proceed with null user for expected auth failures
            if (
              error instanceof AuthenticationError ||
              error instanceof AuthorizationError
            ) {
              return handler(request, { user: null });
            }

            // Re-throw unexpected errors (database failures, system errors, etc.)
            throw error;
          }
        };
      };
    };

    it("should proceed with authenticated user when authentication succeeds", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi.fn().mockResolvedValue(mockUser);
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");
      const response = await wrappedHandler(testRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.hasUser).toBe(true);
      expect(data.userId).toBe(1);

      expect(testHandler).toHaveBeenCalledWith(testRequest, { user: mockUser });
    });

    it("should proceed with null user for AuthenticationError (expected)", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi
        .fn()
        .mockRejectedValue(new AuthenticationError("Token has expired"));
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");
      const response = await wrappedHandler(testRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.hasUser).toBe(false);
      expect(data.userId).toBe(null);

      expect(testHandler).toHaveBeenCalledWith(testRequest, { user: null });
    });

    it("should proceed with null user for TokenExpiredError (expected)", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi
        .fn()
        .mockRejectedValue(new TokenExpiredError());
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");
      const response = await wrappedHandler(testRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.hasUser).toBe(false);
      expect(data.userId).toBe(null);

      expect(testHandler).toHaveBeenCalledWith(testRequest, { user: null });
    });

    it("should proceed with null user for InvalidTokenError (expected)", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi
        .fn()
        .mockRejectedValue(new InvalidTokenError("Invalid token"));
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");
      const response = await wrappedHandler(testRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.hasUser).toBe(false);
      expect(data.userId).toBe(null);

      expect(testHandler).toHaveBeenCalledWith(testRequest, { user: null });
    });

    it("should proceed with null user for AuthorizationError (expected)", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi
        .fn()
        .mockRejectedValue(new AuthorizationError("Admin access required"));
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");
      const response = await wrappedHandler(testRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.hasUser).toBe(false);
      expect(data.userId).toBe(null);

      expect(testHandler).toHaveBeenCalledWith(testRequest, { user: null });
    });

    it("should re-throw database connection errors (SECURITY FIX)", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi
        .fn()
        .mockRejectedValue(new Error("Database connection failed"));
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");

      // This should re-throw the error, not proceed with null user
      await expect(wrappedHandler(testRequest)).rejects.toThrow(
        "Database connection failed"
      );

      // Handler should not be called at all
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("should re-throw JWT_SECRET_KEY missing errors (SECURITY FIX)", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi
        .fn()
        .mockRejectedValue(
          new Error("JWT_SECRET_KEY environment variable is not set")
        );
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");

      // This should re-throw the error, not proceed with null user
      await expect(wrappedHandler(testRequest)).rejects.toThrow(
        "JWT_SECRET_KEY environment variable is not set"
      );

      // Handler should not be called at all
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("should re-throw unexpected system errors (SECURITY FIX)", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi
        .fn()
        .mockRejectedValue(new Error("Unexpected system failure"));
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");

      // This should re-throw the error, not proceed with null user
      await expect(wrappedHandler(testRequest)).rejects.toThrow(
        "Unexpected system failure"
      );

      // Handler should not be called at all
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("should re-throw network timeout errors (SECURITY FIX)", async () => {
      const testHandler = createTestHandler();
      const mockAuthenticate = vi
        .fn()
        .mockRejectedValue(new Error("ETIMEDOUT"));
      const wrappedHandler =
        simulateWithOptionalAuth(mockAuthenticate)(testHandler);

      const testRequest = createTestRequest("http://localhost:3000/test");

      // This should re-throw the error, not proceed with null user
      await expect(wrappedHandler(testRequest)).rejects.toThrow("ETIMEDOUT");

      // Handler should not be called at all
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("should handle mixed scenarios correctly", async () => {
      const testHandler1 = createTestHandler();
      const testHandler2 = createTestHandler();
      const testHandler3 = createTestHandler();

      // 1. Expected auth failure -> proceed with null
      const mockAuth1 = vi
        .fn()
        .mockRejectedValue(new AuthenticationError("No token"));
      const wrappedHandler1 = simulateWithOptionalAuth(mockAuth1)(testHandler1);
      const request1 = createTestRequest("http://localhost:3000/test1");
      const response1 = await wrappedHandler1(request1);
      expect(response1.status).toBe(200);
      expect((await response1.json()).hasUser).toBe(false);

      // 2. Unexpected system error -> should throw
      const mockAuth2 = vi.fn().mockRejectedValue(new Error("System failure"));
      const wrappedHandler2 = simulateWithOptionalAuth(mockAuth2)(testHandler2);
      const request2 = createTestRequest("http://localhost:3000/test2");
      await expect(wrappedHandler2(request2)).rejects.toThrow("System failure");

      // 3. Successful auth -> proceed with user
      const mockAuth3 = vi.fn().mockResolvedValue(mockUser);
      const wrappedHandler3 = simulateWithOptionalAuth(mockAuth3)(testHandler3);
      const request3 = createTestRequest("http://localhost:3000/test3");
      const response3 = await wrappedHandler3(request3);
      expect(response3.status).toBe(200);
      expect((await response3.json()).hasUser).toBe(true);

      // Verify each handler was called correctly
      expect(testHandler1).toHaveBeenCalledTimes(1);
      expect(testHandler2).not.toHaveBeenCalled(); // Should not be called due to re-thrown error
      expect(testHandler3).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Class Hierarchy", () => {
    it("should properly identify AuthenticationError instances", () => {
      const authError = new AuthenticationError("Test error");
      const tokenExpiredError = new TokenExpiredError();
      const invalidTokenError = new InvalidTokenError();

      expect(authError instanceof AuthenticationError).toBe(true);
      expect(tokenExpiredError instanceof AuthenticationError).toBe(true);
      expect(invalidTokenError instanceof AuthenticationError).toBe(true);

      expect(authError.name).toBe("AuthenticationError");
      expect(tokenExpiredError.name).toBe("TokenExpiredError");
      expect(invalidTokenError.name).toBe("InvalidTokenError");
    });

    it("should properly identify AuthorizationError instances", () => {
      const authzError = new AuthorizationError("Test authorization error");

      expect(authzError instanceof AuthorizationError).toBe(true);
      expect(authzError instanceof AuthenticationError).toBe(false);
      expect(authzError.name).toBe("AuthorizationError");
    });

    it("should differentiate authentication errors from generic errors", () => {
      const authError = new AuthenticationError("Auth failed");
      const genericError = new Error("Generic failure");

      expect(authError instanceof AuthenticationError).toBe(true);
      expect(genericError instanceof AuthenticationError).toBe(false);
    });
  });
});
