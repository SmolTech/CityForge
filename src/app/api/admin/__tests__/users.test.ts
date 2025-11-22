import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../users/route";
import {
  createMockRequest,
  createTestToken,
  createMockUser,
  parseJsonResponse,
} from "../../__tests__/setup";

// Mock dependencies
vi.mock("@/lib/db/client", () => ({
  prisma: {
    tokenBlacklist: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/client";

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return list of users for admin", async () => {
    const adminUser = createMockUser({
      id: 1,
      role: "admin",
    });

    const mockUsers = [
      createMockUser({ id: 2, email: "user1@example.com" }),
      createMockUser({ id: 3, email: "user2@example.com" }),
    ];

    const token = createTestToken(adminUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminUser
    );
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUsers
    );
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.users[0].email).toBe("user1@example.com");
    expect(data.users[1].email).toBe("user2@example.com");
  });

  it("should return 403 for non-admin user", async () => {
    const regularUser = createMockUser({
      id: 1,
      role: "user",
    });

    const token = createTestToken(regularUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      regularUser
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(403);
    expect(data.error.message).toBe("Admin access required");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("should return 401 for unauthenticated request", async () => {
    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users",
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error.message).toBe("No authentication token provided");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("should support pagination with limit and offset", async () => {
    const adminUser = createMockUser({ id: 1, role: "admin" });
    const mockUsers = [createMockUser({ id: 2 })];
    const token = createTestToken(adminUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminUser
    );
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUsers
    );
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users?limit=10&offset=20",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.limit).toBe(10);
    expect(data.offset).toBe(20);
    expect(data.total).toBe(50);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      })
    );
  });

  it("should enforce maximum limit of 100", async () => {
    const adminUser = createMockUser({ id: 1, role: "admin" });
    const token = createTestToken(adminUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminUser
    );
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users?limit=500",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.limit).toBe(100); // Capped at 100

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });

  it("should support search by email", async () => {
    const adminUser = createMockUser({ id: 1, role: "admin" });
    const mockUsers = [createMockUser({ email: "john@example.com" })];
    const token = createTestToken(adminUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminUser
    );
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUsers
    );
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users?search=john",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(1);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { email: { contains: "john", mode: "insensitive" } },
            { firstName: { contains: "john", mode: "insensitive" } },
            { lastName: { contains: "john", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });

  it("should format user data correctly", async () => {
    const adminUser = createMockUser({ id: 1, role: "admin" });
    const mockUser = createMockUser({
      id: 2,
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "user",
      isActive: true,
      isSupporterFlag: false,
      createdDate: new Date("2024-01-01"),
      lastLogin: new Date("2024-01-15"),
    });

    const token = createTestToken(adminUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminUser
    );
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockUser,
    ]);
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.users[0]).toEqual({
      id: 2,
      email: "test@example.com",
      first_name: "John",
      last_name: "Doe",
      username: "John Doe",
      role: "user",
      is_active: true,
      is_supporter_flag: false,
      created_date: "2024-01-01T00:00:00.000Z",
      last_login: "2024-01-15T00:00:00.000Z",
    });
  });

  it("should use default pagination values", async () => {
    const adminUser = createMockUser({ id: 1, role: "admin" });
    const token = createTestToken(adminUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminUser
    );
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.limit).toBe(50); // Default
    expect(data.offset).toBe(0); // Default

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
      })
    );
  });

  it("should order users by created date descending", async () => {
    const adminUser = createMockUser({ id: 1, role: "admin" });
    const token = createTestToken(adminUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminUser
    );
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users",
      token,
    });

    await GET(request);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdDate: "desc" },
      })
    );
  });

  it("should handle database errors gracefully", async () => {
    const adminUser = createMockUser({ id: 1, role: "admin" });
    const token = createTestToken(adminUser.id);

    (
      prisma.tokenBlacklist.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminUser
    );
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Database connection failed")
    );

    const request = createMockRequest({
      method: "GET",
      url: "http://localhost:3000/api/admin/users",
      token,
    });

    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(500);
    expect(data.error.message).toBe("Failed to fetch users");
  });
});
