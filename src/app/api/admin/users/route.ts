import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/users - Get list of users (admin only)
 * Supports pagination with offset/limit and optional search
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      // Parse query parameters
      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search")?.trim() || "";
      const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100); // Max 100
      const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

      // Build where clause for search
      const whereClause = search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};

      // Get users with pagination
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          orderBy: { createdDate: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      // Format response to match Flask API
      const formattedUsers = users.map((user) => ({
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        username: `${user.firstName} ${user.lastName}`, // Computed like Flask backend
        role: user.role,
        is_active: user.isActive,
        is_supporter_flag: user.isSupporterFlag,
        support: user.support,
        created_date: user.createdDate,
        last_login: user.lastLogin,
      }));

      return NextResponse.json({
        users: formattedUsers,
        total: totalCount,
        offset,
        limit,
      });
    } catch (error) {
      logger.error("Error fetching admin users:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch users",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
