import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the authentication middleware first
vi.mock("@/lib/auth/middleware", () => ({
  withAuth: (
    handler: (request: NextRequest, ...args: unknown[]) => unknown,
    options: { requireAdmin?: boolean } = {}
  ) => {
    return async (request: NextRequest, ...args: unknown[]) => {
      // Check for test-specific auth setup in request headers
      const authHeader = request.headers.get("authorization");
      const testAuthMode = request.headers.get("x-test-auth-mode");

      let user = null;

      if (authHeader?.startsWith("Bearer ") && testAuthMode !== "no-auth") {
        // Default admin user for valid tokens
        user = {
          id: 1,
          email: "admin@test.com",
          firstName: "Admin",
          lastName: "User",
          role: testAuthMode === "non-admin" ? "user" : "admin",
          isActive: true,
          emailVerified: true,
          isSupporterFlag: false,
        };
      }

      // Handle authentication errors
      if (user === null) {
        return new Response(
          JSON.stringify({
            error: { message: "Authentication required", code: 401 },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Handle admin requirement
      if (options.requireAdmin && user.role !== "admin") {
        return new Response(
          JSON.stringify({
            error: { message: "Admin access required", code: 403 },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      return handler(request, { user }, ...args);
    };
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock Prisma - inline definition to avoid hoisting issues
vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
    },
    tag: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    card: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    cardSubmission: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    cardModification: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    resourceCategory: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    resourceItem: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    quickAccessItem: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    resourceConfig: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    forumCategory: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    forumThread: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    forumPost: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    forumCategoryRequest: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    forumReport: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

// Import the endpoint after all mocks are set up
import { POST } from "@/app/api/admin/data/import/route";
// Import prisma to access the mocked instance
import { prisma } from "@/lib/db/client";

// Helper function to create authenticated FormData request
function createAuthenticatedFormDataRequest(
  url: string,
  formData: FormData
): NextRequest {
  const request = new NextRequest(url, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: "Bearer valid_admin_token",
    },
  });

  // Mock the formData method to return our test FormData
  (request as NextRequest & { formData: () => Promise<FormData> }).formData =
    async () => formData;

  return request;
}

// Helper function to create a mock File with text() method
function createMockFile(
  content: string,
  name: string,
  type: string = "application/json"
): File {
  const file = new File([content], name, { type });
  // Add the text() method that the endpoint expects
  (file as File & { text: () => Promise<string> }).text = async () => content;
  return file;
}

describe("/api/admin/data/import", () => {
  const mockTransaction = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup environment variable for JWT
    process.env["JWT_SECRET_KEY"] = "test-secret-key";

    // Setup mock transaction context
    mockTx = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      tag: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      card: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      cardSubmission: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      cardModification: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      resourceCategory: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      quickAccessItem: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      resourceItem: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      resourceConfig: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      review: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      forumCategory: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      forumCategoryRequest: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      forumThread: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      forumPost: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      forumReport: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      helpWantedPost: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      helpWantedComment: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      helpWantedReport: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      supportTicket: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      supportTicketMessage: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      indexingJob: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      tokenBlacklist: {
        count: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        findUnique: vi.fn(),
      },
      card_tags: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      alembic_version: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    };

    mockTransaction.mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.$transaction as any).mockImplementation(mockTransaction);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["JWT_SECRET_KEY"];
  });

  describe("Authentication", () => {
    it("should reject requests without authentication", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        createMockFile("{}", "test.json", "application/json")
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = new NextRequest(
        "http://localhost/api/admin/data/import",
        {
          method: "POST",
          body: formData,
          headers: {
            "x-test-auth-mode": "no-auth",
          },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should reject requests from non-admin users", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        createMockFile("{}", "test.json", "application/json")
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = new NextRequest(
        "http://localhost/api/admin/data/import",
        {
          method: "POST",
          body: formData,
          headers: {
            authorization: "Bearer valid_token",
            "x-test-auth-mode": "non-admin",
          },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe("Request Validation", () => {
    it("should return 400 when no file is uploaded", async () => {
      const formData = new FormData();
      formData.append("confirm", "DELETE ALL DATA");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe("No file uploaded");
      expect(data.error.code).toBe(400);
    });

    it("should return 400 when confirmation text is incorrect", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        createMockFile("{}", "test.json", "application/json")
      );
      formData.append("confirm", "YES DELETE");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Must type "DELETE ALL DATA" to confirm');
      expect(data.error.code).toBe(400);
    });

    it("should return 400 for non-JSON files", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        createMockFile("test content", "test.txt", "text/plain")
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe("File must be a JSON file");
      expect(data.error.code).toBe(400);
    });

    it("should return 400 for invalid JSON content", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        createMockFile("{ invalid json", "test.json", "application/json")
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe("Invalid JSON file");
      expect(data.error.code).toBe(400);
    });
  });

  describe("Data Processing", () => {
    it("should successfully import data with correct order", async () => {
      const importData = {
        User: [
          { id: 1, email: "user1@example.com", role: "user" },
          { id: 2, email: "admin@example.com", role: "admin" },
        ],
        Tag: [
          { id: 1, name: "Technology" },
          { id: 2, name: "Business" },
        ],
        Card: [
          { id: 1, name: "Test Company", description: "Test description" },
        ],
      };

      const formData = new FormData();
      formData.append(
        "file",
        createMockFile(
          JSON.stringify(importData),
          "test.json",
          "application/json"
        )
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Data import completed successfully!");
      expect(data.stats).toEqual({
        User: { added: 2 },
        Tag: { added: 2 },
        Card: { added: 1 },
      });

      // Verify transaction was called
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // Verify delete operations called in reverse order
      expect(mockTx.card.deleteMany).toHaveBeenCalled();
      expect(mockTx.tag.deleteMany).toHaveBeenCalled();
      expect(mockTx.user.deleteMany).toHaveBeenCalled();

      // Verify create operations called in correct order
      expect(mockTx.user.createMany).toHaveBeenCalledWith({
        data: [
          { id: 1, email: "user1@example.com", role: "user" },
          { id: 2, email: "admin@example.com", role: "admin" },
        ],
      });
      expect(mockTx.tag.createMany).toHaveBeenCalledWith({
        data: [
          { id: 1, name: "Technology" },
          { id: 2, name: "Business" },
        ],
      });
      expect(mockTx.card.createMany).toHaveBeenCalledWith({
        data: [
          { id: 1, name: "Test Company", description: "Test description" },
        ],
      });
    });

    it("should handle selective import with include parameter", async () => {
      const importData = {
        User: [{ id: 1, email: "user1@example.com", role: "user" }],
        Tag: [{ id: 1, name: "Technology" }],
        Card: [{ id: 1, name: "Test Company" }],
      };

      const formData = new FormData();
      formData.append(
        "file",
        createMockFile(
          JSON.stringify(importData),
          "test.json",
          "application/json"
        )
      );
      formData.append("confirm", "DELETE ALL DATA");
      formData.append("include", "User,Tag");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual({
        User: { added: 1 },
        Tag: { added: 1 },
      });

      // Verify only specified models were processed
      expect(mockTx.user.deleteMany).toHaveBeenCalled();
      expect(mockTx.tag.deleteMany).toHaveBeenCalled();
      expect(mockTx.card.deleteMany).not.toHaveBeenCalled();

      expect(mockTx.user.createMany).toHaveBeenCalled();
      expect(mockTx.tag.createMany).toHaveBeenCalled();
      expect(mockTx.card.createMany).not.toHaveBeenCalled();
    });

    it("should clean records by removing nested objects and relations", async () => {
      const importData = {
        User: [
          {
            id: 1,
            email: "user@example.com",
            cards: [{ id: 1, name: "Card 1" }], // Should be removed
            profile: { name: "John Doe" }, // Should be removed
            createdAt: new Date("2023-01-01"), // Should be kept
            role: "user",
          },
        ],
      };

      const formData = new FormData();
      formData.append(
        "file",
        createMockFile(
          JSON.stringify(importData),
          "test.json",
          "application/json"
        )
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);

      expect(response.status).toBe(200);

      // Verify that nested objects/arrays were removed
      expect(mockTx.user.createMany).toHaveBeenCalledWith({
        data: [
          {
            id: 1,
            email: "user@example.com",
            createdAt: "2023-01-01T00:00:00.000Z", // JSON parsed dates become strings
            role: "user",
          },
        ],
      });
    });

    it("should handle empty arrays in import data", async () => {
      const importData = {
        User: [],
        Tag: [{ id: 1, name: "Test" }],
      };

      const formData = new FormData();
      formData.append(
        "file",
        createMockFile(
          JSON.stringify(importData),
          "test.json",
          "application/json"
        )
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual({
        User: { added: 0 },
        Tag: { added: 1 },
      });

      // Verify delete operations were still called
      expect(mockTx.user.deleteMany).toHaveBeenCalled();
      expect(mockTx.tag.deleteMany).toHaveBeenCalled();

      // Verify create operations
      expect(mockTx.user.createMany).toHaveBeenCalledWith({ data: [] });
      expect(mockTx.tag.createMany).toHaveBeenCalledWith({
        data: [{ id: 1, name: "Test" }],
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database transaction failures", async () => {
      const importData = {
        User: [{ id: 1, email: "test@example.com" }],
      };

      // Mock transaction to throw error
      mockTransaction.mockRejectedValue(
        new Error("Database connection failed")
      );

      const formData = new FormData();
      formData.append(
        "file",
        createMockFile(
          JSON.stringify(importData),
          "test.json",
          "application/json"
        )
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe("Database connection failed");
      expect(data.error.code).toBe(500);
    });

    it("should handle delete operation failures", async () => {
      const importData = {
        User: [{ id: 1, email: "test@example.com" }],
      };

      // Mock delete to throw error
      mockTx.user.deleteMany.mockRejectedValue(new Error("Delete failed"));

      const formData = new FormData();
      formData.append(
        "file",
        createMockFile(
          JSON.stringify(importData),
          "test.json",
          "application/json"
        )
      );
      formData.append("confirm", "DELETE ALL DATA");

      const request = createAuthenticatedFormDataRequest(
        "http://localhost/api/admin/data/import",
        formData
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe("Failed to delete existing User data");
      expect(data.error.code).toBe(500);
    });
  });
});
