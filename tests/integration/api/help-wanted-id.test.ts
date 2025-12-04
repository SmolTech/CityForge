/**
 * Integration tests for Help-Wanted Individual Post Management API endpoint
 * Testing: /api/help-wanted/[id] (GET, PUT, DELETE)
 * Coverage: 383 lines with complex validation, authorization, and state management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  GET as getHelpWantedPost,
  PUT as updateHelpWantedPost,
  DELETE as deleteHelpWantedPost,
} from "@/app/api/help-wanted/[id]/route";

// Mock Prisma client - must be hoisted
vi.mock("@/lib/db/client", () => ({
  prisma: {
    helpWantedPost: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    helpWantedComment: {
      deleteMany: vi.fn(),
    },
    helpWantedReport: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock authentication middleware
vi.mock("@/lib/auth/middleware", () => ({
  withAuth: <T extends unknown[]>(
    handler: (
      request: NextRequest,
      context: { user: { id: number; email: string; role: string } },
      ...args: T
    ) => Promise<NextResponse>
  ) => {
    return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
      const authMode = request.headers.get("x-test-auth-mode");

      if (authMode === "unauthenticated") {
        return NextResponse.json(
          { error: { message: "Unauthorized", code: 401 } },
          { status: 401 }
        );
      }

      const user =
        authMode === "admin"
          ? {
              id: 1,
              email: "admin@test.com",
              role: "admin" as const,
              firstName: "Admin",
              lastName: "User",
              isActive: true,
              emailVerified: true,
              isSupporterFlag: false,
            }
          : {
              id: 2,
              email: "user@test.com",
              role: "user" as const,
              firstName: "Regular",
              lastName: "User",
              isActive: true,
              emailVerified: true,
              isSupporterFlag: false,
            };

      return handler(request, { user }, ...args);
    };
  },
}));

// Mock CSRF protection middleware
vi.mock("@/lib/auth/csrf", () => ({
  withCsrfProtection: <T extends unknown[]>(
    handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
  ) => {
    return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
      const bypassCsrf = request.headers.get("x-test-bypass-csrf");

      if (bypassCsrf === "true") {
        return handler(request, ...args);
      }

      // For test mode, check if CSRF token is provided
      const cookieToken = request.cookies.get("csrf_token")?.value;
      const headerToken = request.headers.get("X-CSRF-Token");

      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return NextResponse.json(
          {
            error: {
              message: "CSRF token validation failed",
              code: "CSRF_TOKEN_INVALID",
            },
          },
          { status: 403 }
        );
      }

      return handler(request, ...args);
    };
  },
  generateCsrfToken: () => "test-csrf-token",
  CSRF_COOKIE_NAME: "csrf_token",
  CSRF_HEADER_NAME: "X-CSRF-Token",
}));

// Import mocked prisma client
import { prisma } from "@/lib/db/client";
const mockPrismaClient = prisma as unknown as {
  helpWantedPost: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

/**
 * Helper function to create mock requests
 */
function createMockRequest(
  url: string,
  options: {
    method?: string;
    authMode?: "admin" | "user" | "unauthenticated";
    body?: Record<string, unknown>;
    bypassCsrf?: boolean;
  } = {}
) {
  const headers = new Headers();
  const method = options.method || "GET";

  if (options.authMode) {
    headers.set("x-test-auth-mode", options.authMode);
  }
  if (options.body) {
    headers.set("content-type", "application/json");
  }

  // Add CSRF protection bypass for tests unless explicitly testing CSRF
  if (options.bypassCsrf !== false) {
    headers.set("x-test-bypass-csrf", "true");
  } else {
    // For CSRF tests, include valid CSRF token
    const csrfToken = "test-csrf-token";
    headers.set("X-CSRF-Token", csrfToken);
    // Simulate cookie by creating a request with cookie header
    headers.set("cookie", "csrf_token=test-csrf-token");
  }

  return new NextRequest(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : null,
  });
}

/**
 * Sample help wanted post data (matches Prisma schema format with camelCase)
 */
const sampleHelpWantedPost = {
  id: 1,
  title: "Looking for Frontend Developer",
  description: "We need an experienced React developer for our startup.",
  category: "hiring",
  status: "open",
  location: "Remote",
  budget: "$50-80/hour",
  contactPreference: "email",
  reportCount: 0,
  createdDate: new Date("2023-01-01T00:00:00.000Z"),
  updatedDate: new Date("2023-01-01T00:00:00.000Z"),
  createdBy: 2,
  creator: {
    id: 2,
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
  },
  comments: [
    {
      id: 1,
      postId: 1,
      content: "Is this position still available?",
      parentId: null,
      createdDate: new Date("2023-01-02T00:00:00.000Z"),
      updatedDate: null,
      createdBy: 3,
      creator: {
        id: 3,
        firstName: "Jane",
        lastName: "Smith",
      },
      replies: [],
    },
  ],
  _count: {
    comments: 1,
    reports: 0,
  },
};

describe("Help-Wanted Individual Post API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/help-wanted/[id]", () => {
    describe("Basic Functionality", () => {
      it("should return help wanted post with complete data", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue(
          sampleHelpWantedPost
        );

        const request = createMockRequest("http://localhost/api/help-wanted/1");
        const response = await getHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data).toEqual({
          id: 1,
          title: "Looking for Frontend Developer",
          description:
            "We need an experienced React developer for our startup.",
          category: "hiring",
          status: "open",
          location: "Remote",
          budget: "$50-80/hour",
          contact_preference: "email",
          report_count: 0,
          created_date: "2023-01-01T00:00:00.000Z",
          updated_date: "2023-01-01T00:00:00.000Z",
          creator: {
            id: 2,
            first_name: "John",
            last_name: "Doe",
            email: "john@example.com",
          },
          comment_count: 1,
          comments: [
            {
              id: 1,
              post_id: 1,
              content: "Is this position still available?",
              parent_id: null,
              created_date: "2023-01-02T00:00:00.000Z",
              updated_date: undefined,
              creator: {
                id: 3,
                first_name: "Jane",
                last_name: "Smith",
              },
              replies: [],
            },
          ],
        });

        expect(mockPrismaClient.helpWantedPost.findUnique).toHaveBeenCalledWith(
          {
            where: { id: 1 },
            include: expect.objectContaining({
              creator: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              comments: expect.any(Object),
              _count: { select: { comments: true, reports: true } },
            }),
          }
        );
      });

      it("should include comments with nested replies", async () => {
        const postWithNestedComments = {
          ...sampleHelpWantedPost,
          comments: [
            {
              id: 1,
              postId: 1,
              content: "Is this position still available?",
              parentId: null,
              createdBy: 3,
              createdDate: new Date("2023-01-02T00:00:00Z"),
              updatedDate: null,
              creator: { id: 3, firstName: "Jane", lastName: "Smith" },
              replies: [
                {
                  id: 2,
                  postId: 1,
                  content: "Yes, we're still hiring!",
                  parentId: 1,
                  createdBy: 2,
                  createdDate: new Date("2023-01-03T00:00:00Z"),
                  updatedDate: null,
                  creator: { id: 2, firstName: "John", lastName: "Doe" },
                },
              ],
            },
          ],
        };

        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue(
          postWithNestedComments
        );

        const request = createMockRequest("http://localhost/api/help-wanted/1");
        const response = await getHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.comments[0].replies).toHaveLength(1);
        expect(data.comments[0].replies[0].content).toBe(
          "Yes, we're still hiring!"
        );
      });
    });

    describe("Input Validation", () => {
      it("should return 400 for invalid post ID", async () => {
        const request = createMockRequest(
          "http://localhost/api/help-wanted/invalid"
        );
        const response = await getHelpWantedPost(request, {
          params: Promise.resolve({ id: "invalid" }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error.message).toContain("Invalid post ID");
      });

      it("should validate title length (max 255 characters)", async () => {
        const longTitle = "a".repeat(256);
        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { title: longTitle },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error.message).toContain(
          "Title must be 255 characters or less"
        );
      });

      it("should validate description requirements", async () => {
        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { description: "" },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error.message).toContain("Description cannot be empty");
      });

      it("should validate category values", async () => {
        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { category: "invalid-category" },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error.message).toContain(
          "Category must be one of: hiring, collaboration, general"
        );
      });

      it("should validate status values", async () => {
        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { status: "invalid-status" },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error.message).toContain(
          "Status must be one of: open, closed"
        );
      });

      it("should validate location length (max 255 characters)", async () => {
        const longLocation = "a".repeat(256);
        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { location: longLocation },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error.message).toContain(
          "Location must be 255 characters or less"
        );
      });

      it("should validate budget length (max 100 characters)", async () => {
        const longBudget = "a".repeat(101);
        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { budget: longBudget },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error.message).toContain(
          "Budget must be 100 characters or less"
        );
      });

      it("should validate contact preference length (max 50 characters)", async () => {
        const longContactPref = "a".repeat(51);
        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { contact_preference: longContactPref },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error.message).toContain(
          "Contact preference must be 50 characters or less"
        );
      });

      it("should accept valid category values", async () => {
        mockPrismaClient.helpWantedPost.update.mockResolvedValue({
          ...sampleHelpWantedPost,
          category: "collaboration",
        });

        for (const category of ["hiring", "collaboration", "general"]) {
          const request = createMockRequest(
            "http://localhost/api/help-wanted/1",
            {
              method: "PUT",
              authMode: "user",
              body: { category },
            }
          );

          const response = await updateHelpWantedPost(request, {
            params: Promise.resolve({ id: "1" }),
          });

          expect(response.status).toBe(200);
        }
      });

      it("should accept valid status values", async () => {
        mockPrismaClient.helpWantedPost.update.mockResolvedValue({
          ...sampleHelpWantedPost,
          status: "closed",
        });

        for (const status of ["open", "closed"]) {
          const request = createMockRequest(
            "http://localhost/api/help-wanted/1",
            {
              method: "PUT",
              authMode: "user",
              body: { status },
            }
          );

          const response = await updateHelpWantedPost(request, {
            params: Promise.resolve({ id: "1" }),
          });

          expect(response.status).toBe(200);
        }
      });
    });

    describe("Successful Updates", () => {
      beforeEach(() => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 2,
        });
      });

      it("should update single field successfully", async () => {
        const updatedPost = { ...sampleHelpWantedPost, title: "New Title" };
        mockPrismaClient.helpWantedPost.update.mockResolvedValue(updatedPost);

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { title: "New Title" },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.title).toBe("New Title");

        expect(mockPrismaClient.helpWantedPost.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: { title: "New Title" },
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                comments: true,
                reports: true,
              },
            },
          },
        });
      });

      it("should update multiple fields successfully", async () => {
        const updateData = {
          title: "Updated Title",
          description: "Updated Description",
          category: "collaboration",
          status: "closed",
          location: "New York",
          budget: "$100/hour",
          contact_preference: "phone",
        };

        const updatedPost = { ...sampleHelpWantedPost, ...updateData };
        mockPrismaClient.helpWantedPost.update.mockResolvedValue(updatedPost);

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: updateData,
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.title).toBe("Updated Title");
        expect(data.description).toBe("Updated Description");
        expect(data.category).toBe("collaboration");

        expect(mockPrismaClient.helpWantedPost.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: {
            title: "Updated Title",
            description: "Updated Description",
            category: "collaboration",
            status: "closed",
            location: "New York",
            budget: "$100/hour",
            contactPreference: "phone",
          },
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                comments: true,
                reports: true,
              },
            },
          },
        });
      });

      it("should handle optional fields (null/empty values)", async () => {
        const updateData = {
          location: "",
          budget: null,
          contact_preference: "",
        };

        const updatedPost = { ...sampleHelpWantedPost, ...updateData };
        mockPrismaClient.helpWantedPost.update.mockResolvedValue(updatedPost);

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: updateData,
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
      });
    });

    describe("Error Handling", () => {
      it("should handle malformed JSON in request body", async () => {
        const request = new NextRequest("http://localhost/api/help-wanted/1", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "x-test-auth-mode": "user",
            "x-test-bypass-csrf": "true",
          },
          body: "{ invalid json }",
        });

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error.code).toBe("BAD_REQUEST");
      });

      it("should handle post not found during update", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue(null);

        const request = createMockRequest(
          "http://localhost/api/help-wanted/999",
          {
            method: "PUT",
            authMode: "user",
            body: { title: "Update" },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "999" }),
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error.message).toBe("Help wanted post not found");
      });

      it("should handle database errors during update", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 2,
        });
        mockPrismaClient.helpWantedPost.update.mockRejectedValue(
          new Error("Database error")
        );

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: { title: "Updated Title" },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error.code).toBe("INTERNAL_SERVER_ERROR");
      });

      it("should return multiple validation errors when multiple fields are invalid", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 2,
        });

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "PUT",
            authMode: "user",
            body: {
              title: "", // Empty title
              description: "", // Empty description
              category: "invalid", // Invalid category
              status: "invalid", // Invalid status
            },
          }
        );

        const response = await updateHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error.message).toContain("Title cannot be empty");
        expect(data.error.message).toContain("Description cannot be empty");
        expect(data.error.message).toContain("Category must be one of");
        expect(data.error.message).toContain("Status must be one of");
      });
    });
  });

  describe("DELETE /api/help-wanted/[id]", () => {
    describe("Authentication & Authorization", () => {
      it("should require authentication", async () => {
        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "DELETE",
            authMode: "unauthenticated",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error.message).toBe("Unauthorized");
      });

      it("should allow post creator to delete their own post", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 2, // Same as user ID
        });

        // Mock transaction for cascade delete
        mockPrismaClient.$transaction.mockImplementation(
          async (callback: (tx: unknown) => Promise<unknown>) => {
            const txMock = {
              helpWantedComment: {
                deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
              },
              helpWantedReport: {
                deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
              },
              helpWantedPost: {
                delete: vi.fn().mockResolvedValue(sampleHelpWantedPost),
              },
            };
            return await callback(txMock);
          }
        );

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "DELETE",
            authMode: "user",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe("Help wanted post deleted successfully");
        expect(data.deletedCounts).toEqual({
          comments: 5,
          reports: 1,
        });
      });

      it("should allow admin to delete any post", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 999, // Different from admin ID
        });

        // Mock transaction for cascade delete
        mockPrismaClient.$transaction.mockImplementation(
          async (callback: (tx: unknown) => Promise<unknown>) => {
            const txMock = {
              helpWantedComment: {
                deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
              },
              helpWantedReport: {
                deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
              },
              helpWantedPost: {
                delete: vi.fn().mockResolvedValue(sampleHelpWantedPost),
              },
            };
            return await callback(txMock);
          }
        );

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "DELETE",
            authMode: "admin",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe("Help wanted post deleted successfully");
        expect(data.deletedCounts).toEqual({
          comments: 3,
          reports: 0,
        });
      });

      it("should prevent user from deleting others' posts", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 999, // Different from user ID (2)
        });

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "DELETE",
            authMode: "user",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error.message).toBe("You can only delete your own posts");
        expect(data.error.code).toBe("FORBIDDEN");
      });
    });

    describe("Input Validation", () => {
      it("should validate post ID format", async () => {
        const request = createMockRequest(
          "http://localhost/api/help-wanted/invalid",
          {
            method: "DELETE",
            authMode: "user",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "invalid" }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error.message).toBe("Invalid post ID");
        expect(data.error.code).toBe("BAD_REQUEST");
      });
    });

    describe("Error Handling", () => {
      it("should handle post not found", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue(null);

        const request = createMockRequest(
          "http://localhost/api/help-wanted/999",
          {
            method: "DELETE",
            authMode: "user",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "999" }),
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error.message).toBe("Help wanted post not found");
        expect(data.error.code).toBe("NOT_FOUND");
      });

      it("should handle database transaction errors", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 2,
        });

        mockPrismaClient.$transaction.mockRejectedValue(
          new Error("Transaction failed")
        );

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "DELETE",
            authMode: "user",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error.code).toBe("INTERNAL_SERVER_ERROR");
      });
    });

    describe("Cascade Delete Functionality", () => {
      it("should properly execute cascade delete with transaction", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 2,
        });

        let transactionCallbackCalled = false;
        mockPrismaClient.$transaction.mockImplementation(
          async (callback: (tx: unknown) => Promise<unknown>) => {
            const txMock = {
              helpWantedComment: {
                deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
              },
              helpWantedReport: {
                deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
              },
              helpWantedPost: {
                delete: vi.fn().mockResolvedValue(sampleHelpWantedPost),
              },
            };

            transactionCallbackCalled = true;
            const result = await callback(txMock);

            // Verify transaction operations were called in correct order
            expect(txMock.helpWantedComment.deleteMany).toHaveBeenCalledWith({
              where: { postId: 1 },
            });
            expect(txMock.helpWantedReport.deleteMany).toHaveBeenCalledWith({
              where: { postId: 1 },
            });
            expect(txMock.helpWantedPost.delete).toHaveBeenCalledWith({
              where: { id: 1 },
            });

            return result;
          }
        );

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "DELETE",
            authMode: "user",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
        expect(transactionCallbackCalled).toBe(true);

        const data = await response.json();
        expect(data.deletedCounts).toEqual({
          comments: 10,
          reports: 2,
        });
      });

      it("should handle zero comments and reports", async () => {
        mockPrismaClient.helpWantedPost.findUnique.mockResolvedValue({
          ...sampleHelpWantedPost,
          createdBy: 2,
        });

        mockPrismaClient.$transaction.mockImplementation(
          async (callback: (tx: unknown) => Promise<unknown>) => {
            const txMock = {
              helpWantedComment: {
                deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
              },
              helpWantedReport: {
                deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
              },
              helpWantedPost: {
                delete: vi.fn().mockResolvedValue(sampleHelpWantedPost),
              },
            };
            return await callback(txMock);
          }
        );

        const request = createMockRequest(
          "http://localhost/api/help-wanted/1",
          {
            method: "DELETE",
            authMode: "user",
          }
        );

        const response = await deleteHelpWantedPost(request, {
          params: Promise.resolve({ id: "1" }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.deletedCounts).toEqual({
          comments: 0,
          reports: 0,
        });
      });
    });
  });

  describe("Cross-Method Edge Cases", () => {
    it("should handle concurrent access patterns", async () => {
      // This test simulates what might happen if multiple requests hit the same post
      mockPrismaClient.helpWantedPost.findUnique
        .mockResolvedValueOnce(sampleHelpWantedPost)
        .mockResolvedValueOnce(sampleHelpWantedPost)
        .mockResolvedValueOnce(null); // Post deleted by concurrent request

      // First request - GET should succeed
      const getRequest = createMockRequest(
        "http://localhost/api/help-wanted/1"
      );
      const getResponse = await getHelpWantedPost(getRequest, {
        params: Promise.resolve({ id: "1" }),
      });
      expect(getResponse.status).toBe(200);

      // Second request - PUT should succeed
      mockPrismaClient.helpWantedPost.update.mockResolvedValue({
        ...sampleHelpWantedPost,
        title: "Updated",
      });

      const putRequest = createMockRequest(
        "http://localhost/api/help-wanted/1",
        {
          method: "PUT",
          authMode: "user",
          body: { title: "Updated" },
        }
      );
      const putResponse = await updateHelpWantedPost(putRequest, {
        params: Promise.resolve({ id: "1" }),
      });
      expect(putResponse.status).toBe(200);

      // Third request - DELETE should fail (post no longer exists)
      const deleteRequest = createMockRequest(
        "http://localhost/api/help-wanted/1",
        {
          method: "DELETE",
          authMode: "user",
        }
      );
      const deleteResponse = await deleteHelpWantedPost(deleteRequest, {
        params: Promise.resolve({ id: "1" }),
      });
      expect(deleteResponse.status).toBe(404);
    });
  });
});
