/**
 * Integration tests for Admin Forums Categories API endpoints
 * Testing: /api/admin/forums/categories and /api/admin/forums/categories/[id]
 * Coverage: 609 lines across 5 HTTP methods with complex database operations
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  GET as getCategories,
  POST as createCategory,
} from "@/app/api/admin/forums/categories/route";
import {
  GET as getCategory,
  PUT as updateCategory,
  DELETE as deleteCategory,
} from "@/app/api/admin/forums/categories/[id]/route";

// Mock Prisma client - must be hoisted
vi.mock("@/lib/db/client", () => ({
  prisma: {
    forumCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    forumPost: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    forumThread: {
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

// Mock authentication middleware - header-based test mode
vi.mock("@/lib/auth/middleware", () => ({
  withAuth: (
    handler: (request: NextRequest, ...args: unknown[]) => unknown,
    options?: { requireAdmin?: boolean }
  ) => {
    return async (request: NextRequest, ...args: unknown[]) => {
      const authMode = request.headers.get("x-test-auth-mode");

      if (authMode === "unauthenticated") {
        return NextResponse.json(
          { error: { message: "Unauthorized", code: 401 } },
          { status: 401 }
        );
      }

      if (options?.requireAdmin && authMode !== "admin") {
        return NextResponse.json(
          { error: { message: "Admin access required", code: 403 } },
          { status: 403 }
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

// Import mocked prisma client
import { prisma } from "@/lib/db/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaClient = prisma as any;

/**
 * Helper function to create mock requests with proper headers
 */
function createMockRequest(
  url: string,
  options: {
    method?: string;
    authMode?: "admin" | "user" | "unauthenticated";
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
) {
  const { method = "GET", authMode = "admin", body, headers = {} } = options;

  const requestHeaders: Record<string, string> = {
    "content-type": "application/json",
    "x-test-auth-mode": authMode,
    ...headers,
  };

  const requestInit: Record<string, unknown> = {
    method,
    headers: requestHeaders,
  };

  if (body && (method === "POST" || method === "PUT")) {
    requestInit["body"] = JSON.stringify(body);
  }

  return new NextRequest(url, requestInit);
}

/**
 * Sample forum category data for testing
 */
const sampleCategory = {
  id: 1,
  name: "General Discussion",
  description: "General community discussion",
  slug: "general-discussion",
  displayOrder: 0,
  isActive: true,
  createdDate: new Date("2024-01-01"),
  updatedDate: new Date("2024-01-01"),
  createdBy: 1,
  creator: {
    id: 1,
    firstName: "Admin",
    lastName: "User",
  },
  _count: {
    threads: 5,
  },
};

const sampleSecondCategory = {
  id: 2,
  name: "Announcements",
  description: "Official announcements",
  slug: "announcements",
  displayOrder: 1,
  isActive: true,
  createdDate: new Date("2024-01-02"),
  updatedDate: new Date("2024-01-02"),
  createdBy: 1,
  creator: {
    id: 1,
    firstName: "Admin",
    lastName: "User",
  },
  _count: {
    threads: 2,
  },
};

describe("Admin Forums Categories API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/forums/categories", () => {
    it("should fetch all forum categories for admin users", async () => {
      mockPrismaClient.forumCategory.findMany.mockResolvedValue([
        sampleCategory,
        sampleSecondCategory,
      ]);
      mockPrismaClient.forumPost.count
        .mockResolvedValueOnce(25) // Posts for first category
        .mockResolvedValueOnce(10); // Posts for second category

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        { authMode: "admin" }
      );
      const response = await getCategories(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: 1,
        name: "General Discussion",
        description: "General community discussion",
        slug: "general-discussion",
        display_order: 0,
        is_active: true,
        creator: {
          id: 1,
          first_name: "Admin",
          last_name: "User",
        },
        thread_count: 5,
        post_count: 25,
      });

      expect(data[1]).toMatchObject({
        id: 2,
        name: "Announcements",
        description: "Official announcements",
        slug: "announcements",
        display_order: 1,
        is_active: true,
        thread_count: 2,
        post_count: 10,
      });

      expect(mockPrismaClient.forumCategory.findMany).toHaveBeenCalledWith({
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              threads: true,
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      });

      expect(mockPrismaClient.forumPost.count).toHaveBeenCalledTimes(2);
    });

    it("should return empty array when no categories exist", async () => {
      mockPrismaClient.forumCategory.findMany.mockResolvedValue([]);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        { authMode: "admin" }
      );
      const response = await getCategories(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it("should handle database errors gracefully", async () => {
      mockPrismaClient.forumCategory.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        { authMode: "admin" }
      );
      const response = await getCategories(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Failed to fetch forum categories",
        code: 500,
      });
    });

    it("should require admin authentication", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          authMode: "user",
        }
      );
      const response = await getCategories(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toBe("Admin access required");
    });

    it("should require authentication", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          authMode: "unauthenticated",
        }
      );
      const response = await getCategories(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.message).toBe("Unauthorized");
    });
  });

  describe("POST /api/admin/forums/categories", () => {
    it("should create a new forum category", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(null); // No existing category
      mockPrismaClient.forumCategory.create.mockResolvedValue(sampleCategory);

      const categoryData = {
        name: "General Discussion",
        description: "General community discussion",
        display_order: 0,
        is_active: true,
      };

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          method: "POST",
          body: categoryData,
        }
      );

      const response = await createCategory(request);

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toMatchObject({
        id: 1,
        name: "General Discussion",
        description: "General community discussion",
        slug: "general-discussion",
        display_order: 0,
        is_active: true,
        creator: {
          id: 1,
          first_name: "Admin",
          last_name: "User",
        },
        thread_count: 0,
        post_count: 0,
      });

      expect(mockPrismaClient.forumCategory.create).toHaveBeenCalledWith({
        data: {
          name: "General Discussion",
          description: "General community discussion",
          slug: "general-discussion",
          displayOrder: 0,
          isActive: true,
          createdBy: 1,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    it("should generate correct slug from category name", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(null);
      mockPrismaClient.forumCategory.create.mockResolvedValue({
        ...sampleCategory,
        name: "Test & Special Characters!",
        slug: "test-special-characters",
      });

      const categoryData = {
        name: "Test & Special Characters!",
        description: "Test category with special characters",
      };

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          method: "POST",
          body: categoryData,
        }
      );

      const response = await createCategory(request);

      expect(response.status).toBe(201);
      expect(mockPrismaClient.forumCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: "test-special-characters",
          }),
        })
      );
    });

    it("should use default values for optional fields", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(null);
      mockPrismaClient.forumCategory.create.mockResolvedValue(sampleCategory);

      const categoryData = {
        name: "General Discussion",
        description: "General community discussion",
        // No display_order or is_active provided
      };

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          method: "POST",
          body: categoryData,
        }
      );

      const response = await createCategory(request);

      expect(response.status).toBe(201);
      expect(mockPrismaClient.forumCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayOrder: 0, // default value
            isActive: true, // default value
          }),
        })
      );
    });

    it("should validate required fields", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          method: "POST",
          body: { name: "Test Category" }, // Missing description
        }
      );

      const response = await createCategory(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Name and description are required",
        code: 400,
      });
    });

    it("should prevent duplicate slugs", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(
        sampleCategory
      ); // Existing category with same slug

      const categoryData = {
        name: "General Discussion", // Same as existing category
        description: "Another general discussion",
      };

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          method: "POST",
          body: categoryData,
        }
      );

      const response = await createCategory(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "A category with this name already exists",
        code: 400,
      });
    });

    it("should handle database errors", async () => {
      mockPrismaClient.forumCategory.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const categoryData = {
        name: "Test Category",
        description: "Test description",
      };

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          method: "POST",
          body: categoryData,
        }
      );

      const response = await createCategory(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Failed to create forum category",
        code: 500,
      });
    });

    it("should require admin authentication", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories",
        {
          method: "POST",
          authMode: "user",
          body: { name: "Test", description: "Test" },
        }
      );

      const response = await createCategory(request);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/admin/forums/categories/[id]", () => {
    it("should fetch specific forum category", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(
        sampleCategory
      );
      mockPrismaClient.forumPost.count.mockResolvedValue(25);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        { authMode: "admin" }
      );

      const response = await getCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toMatchObject({
        id: 1,
        name: "General Discussion",
        description: "General community discussion",
        slug: "general-discussion",
        display_order: 0,
        is_active: true,
        creator: {
          id: 1,
          first_name: "Admin",
          last_name: "User",
        },
        thread_count: 5,
        post_count: 25,
      });

      expect(mockPrismaClient.forumCategory.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              threads: true,
            },
          },
        },
      });

      expect(mockPrismaClient.forumPost.count).toHaveBeenCalledWith({
        where: {
          thread: {
            categoryId: 1,
          },
        },
      });
    });

    it("should handle invalid category ID", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/invalid",
        { authMode: "admin" }
      );

      const response = await getCategory(request, {
        params: Promise.resolve({ id: "invalid" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Invalid category ID",
        code: 400,
      });
    });

    it("should handle category not found", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/999",
        { authMode: "admin" }
      );

      const response = await getCategory(request, {
        params: Promise.resolve({ id: "999" }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Category not found",
        code: 404,
      });
    });

    it("should handle database errors", async () => {
      mockPrismaClient.forumCategory.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        { authMode: "admin" }
      );

      const response = await getCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Failed to fetch forum category",
        code: 500,
      });
    });

    it("should require admin authentication", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          authMode: "user",
        }
      );

      const response = await getCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("PUT /api/admin/forums/categories/[id]", () => {
    it("should update forum category", async () => {
      const updatedCategory = {
        ...sampleCategory,
        name: "Updated Discussion",
        description: "Updated description",
        slug: "updated-discussion",
        displayOrder: 1,
        isActive: false,
      };

      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(
        sampleCategory
      );
      mockPrismaClient.forumCategory.findFirst.mockResolvedValue(null); // No slug conflict
      mockPrismaClient.forumCategory.update.mockResolvedValue(updatedCategory);
      mockPrismaClient.forumPost.count.mockResolvedValue(30);

      const updateData = {
        name: "Updated Discussion",
        description: "Updated description",
        display_order: 1,
        is_active: false,
      };

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          method: "PUT",
          body: updateData,
        }
      );

      const response = await updateCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toMatchObject({
        id: 1,
        name: "Updated Discussion",
        description: "Updated description",
        slug: "updated-discussion",
        display_order: 1,
        is_active: false,
        post_count: 30,
      });

      expect(mockPrismaClient.forumCategory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          updatedDate: expect.any(Date),
          name: "Updated Discussion",
          slug: "updated-discussion",
          description: "Updated description",
          displayOrder: 1,
          isActive: false,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              threads: true,
            },
          },
        },
      });
    });

    it("should update partial fields", async () => {
      const updatedCategory = {
        ...sampleCategory,
        description: "Only description updated",
      };

      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(
        sampleCategory
      );
      mockPrismaClient.forumCategory.update.mockResolvedValue(updatedCategory);
      mockPrismaClient.forumPost.count.mockResolvedValue(25);

      const updateData = {
        description: "Only description updated",
        // Only updating description, leaving other fields unchanged
      };

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          method: "PUT",
          body: updateData,
        }
      );

      const response = await updateCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(200);
      expect(mockPrismaClient.forumCategory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          updatedDate: expect.any(Date),
          description: "Only description updated",
        },
        include: expect.any(Object),
      });
    });

    it("should prevent slug conflicts when updating name", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(
        sampleCategory
      );
      mockPrismaClient.forumCategory.findFirst.mockResolvedValue(
        sampleSecondCategory
      ); // Conflicting slug

      const updateData = {
        name: "Announcements", // Same as another category
      };

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          method: "PUT",
          body: updateData,
        }
      );

      const response = await updateCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "A category with this name already exists",
        code: 400,
      });
    });

    it("should handle invalid category ID", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/invalid",
        {
          method: "PUT",
          body: { name: "Test" },
        }
      );

      const response = await updateCategory(request, {
        params: Promise.resolve({ id: "invalid" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Invalid category ID",
        code: 400,
      });
    });

    it("should handle category not found", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/999",
        {
          method: "PUT",
          body: { name: "Test" },
        }
      );

      const response = await updateCategory(request, {
        params: Promise.resolve({ id: "999" }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Category not found",
        code: 404,
      });
    });

    it("should handle database errors", async () => {
      mockPrismaClient.forumCategory.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          method: "PUT",
          body: { name: "Test" },
        }
      );

      const response = await updateCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Failed to update forum category",
        code: 500,
      });
    });

    it("should require admin authentication", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          method: "PUT",
          authMode: "user",
          body: { name: "Test" },
        }
      );

      const response = await updateCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/admin/forums/categories/[id]", () => {
    it("should delete forum category and related data", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(
        sampleCategory
      );

      // Mock transaction function
      mockPrismaClient.$transaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: any) => {
          // Create a mock transaction object
          const txMock = {
            forumPost: {
              deleteMany: vi.fn().mockResolvedValue({ count: 25 }),
            },
            forumThread: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
            forumCategory: {
              delete: vi.fn().mockResolvedValue(sampleCategory),
            },
          };

          return callback(txMock);
        }
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          method: "DELETE",
        }
      );

      const response = await deleteCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        message: "Category deleted successfully",
      });

      // Verify transaction was called
      expect(mockPrismaClient.$transaction).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it("should handle invalid category ID", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/invalid",
        {
          method: "DELETE",
        }
      );

      const response = await deleteCategory(request, {
        params: Promise.resolve({ id: "invalid" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Invalid category ID",
        code: 400,
      });
    });

    it("should handle category not found", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/999",
        {
          method: "DELETE",
        }
      );

      const response = await deleteCategory(request, {
        params: Promise.resolve({ id: "999" }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Category not found",
        code: 404,
      });
    });

    it("should handle transaction errors", async () => {
      mockPrismaClient.forumCategory.findUnique.mockResolvedValue(
        sampleCategory
      );
      mockPrismaClient.$transaction.mockRejectedValue(
        new Error("Transaction failed")
      );

      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          method: "DELETE",
        }
      );

      const response = await deleteCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: "Failed to delete forum category",
        code: 500,
      });
    });

    it("should require admin authentication", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/admin/forums/categories/1",
        {
          method: "DELETE",
          authMode: "user",
        }
      );

      const response = await deleteCategory(request, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(403);
    });
  });
});
