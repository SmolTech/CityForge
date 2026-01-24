import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { withErrorHandler, BadRequestError, NotFoundError } from "@/lib/errors";
import { z } from "zod";

// Validation schemas for batch operations
const batchUpdateSchema = z.object({
  userIds: z.array(z.number()).min(1).max(100), // Limit to 100 users per batch
  action: z.enum(["deactivate", "activate"]),
});

const batchDeleteSchema = z.object({
  userIds: z.array(z.number()).min(1).max(100), // Limit to 100 users per batch
});

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
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            isSupporterFlag: true,
            support: true,
            emailVerified: true,
            createdDate: true,
            lastLogin: true,
            registrationIpAddress: true,
          },
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
        email_verified: user.emailVerified,
        created_date: user.createdDate,
        last_login: user.lastLogin,
        registration_ip_address: user.registrationIpAddress,
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

/**
 * PUT /api/admin/users - Batch update users (admin only)
 * Supports batch deactivation/activation
 */
export const PUT = withAuth(
  withErrorHandler(async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { userIds, action } = batchUpdateSchema.parse(body);

      logger.info(
        `Admin batch ${action} for ${userIds.length} users:`,
        userIds
      );

      // Validate that users exist
      const existingUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, role: true },
      });

      if (existingUsers.length !== userIds.length) {
        const foundIds = existingUsers.map((u) => u.id);
        const missingIds = userIds.filter(
          (id: number) => !foundIds.includes(id)
        );
        throw new NotFoundError(`Users not found: ${missingIds.join(", ")}`);
      }

      // Prevent deactivating admin users (safety check)
      const adminUsers = existingUsers.filter((user) => user.role === "admin");
      if (action === "deactivate" && adminUsers.length > 0) {
        const adminEmails = adminUsers.map((u) => u.email);
        throw new BadRequestError(
          `Cannot deactivate admin users: ${adminEmails.join(", ")}`
        );
      }

      const isActive = action === "activate";

      // Perform batch update
      const result = await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { isActive },
      });

      logger.info(`Batch ${action} completed: ${result.count} users updated`);

      return NextResponse.json({
        message: `Successfully ${action}d ${result.count} users`,
        count: result.count,
        action,
      });
    } catch (error) {
      logger.error("Error in batch user update:", error);
      if (error instanceof z.ZodError) {
        throw new BadRequestError(
          `Invalid input: ${error.issues[0]?.message || "Validation error"}`
        );
      }
      throw error;
    }
  }, "PUT /api/admin/users"),
  { requireAdmin: true }
);

/**
 * DELETE /api/admin/users - Batch delete users (admin only)
 * Performs hard delete of user accounts
 */
export const DELETE = withAuth(
  withErrorHandler(async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { userIds } = batchDeleteSchema.parse(body);

      logger.warn(`Admin batch delete for ${userIds.length} users:`, userIds);

      // Validate that users exist and get their details
      const existingUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, role: true },
      });

      if (existingUsers.length !== userIds.length) {
        const foundIds = existingUsers.map((u) => u.id);
        const missingIds = userIds.filter(
          (id: number) => !foundIds.includes(id)
        );
        throw new NotFoundError(`Users not found: ${missingIds.join(", ")}`);
      }

      // Prevent deleting admin users (safety check)
      const adminUsers = existingUsers.filter((user) => user.role === "admin");
      if (adminUsers.length > 0) {
        const adminEmails = adminUsers.map((u) => u.email);
        throw new BadRequestError(
          `Cannot delete admin users: ${adminEmails.join(", ")}`
        );
      }

      // Perform batch delete in transaction to handle foreign key constraints
      const result = await prisma.$transaction(async (tx) => {
        // Delete related records first to avoid foreign key constraints
        await tx.tokenBlacklist.deleteMany({
          where: { userId: { in: userIds } },
        });

        await tx.review.deleteMany({
          where: { userId: { in: userIds } },
        });

        await tx.forumPost.deleteMany({
          where: { createdBy: { in: userIds } },
        });

        await tx.forumThread.deleteMany({
          where: { createdBy: { in: userIds } },
        });

        await tx.helpWantedPost.deleteMany({
          where: { createdBy: { in: userIds } },
        });

        await tx.helpWantedComment.deleteMany({
          where: { createdBy: { in: userIds } },
        });

        await tx.supportTicket.deleteMany({
          where: { createdBy: { in: userIds } },
        });

        await tx.supportTicketMessage.deleteMany({
          where: { createdBy: { in: userIds } },
        });

        await tx.cardSubmission.deleteMany({
          where: { submittedBy: { in: userIds } },
        });

        await tx.cardModification.deleteMany({
          where: { submittedBy: { in: userIds } },
        });

        // Finally delete the users
        const deleteResult = await tx.user.deleteMany({
          where: { id: { in: userIds } },
        });

        return deleteResult;
      });

      logger.warn(`Batch delete completed: ${result.count} users deleted`);

      return NextResponse.json({
        message: `Successfully deleted ${result.count} users`,
        count: result.count,
      });
    } catch (error) {
      logger.error("Error in batch user delete:", error);
      if (error instanceof z.ZodError) {
        throw new BadRequestError(
          `Invalid input: ${error.issues[0]?.message || "Validation error"}`
        );
      }
      throw error;
    }
  }, "DELETE /api/admin/users"),
  { requireAdmin: true }
);
