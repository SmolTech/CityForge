import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/support-tickets/stats
 * Get support ticket statistics (filtered by user role)
 */
export const GET = withAuth(async (_, { user }) => {
  try {
    logger.info("Getting support ticket statistics", {
      userId: user.id,
      isSupporter: user.isSupporterFlag,
    });

    // Build where clause based on user role
    interface WhereClause {
      createdBy?: number;
      assignedTo?: number;
    }
    const whereClause: WhereClause = {};

    // Non-supporters can only see their own tickets
    if (!user.isSupporterFlag) {
      whereClause.createdBy = user.id;
    }

    // Get counts by status
    const statusCounts = await prisma.supportTicket.groupBy({
      by: ["status"],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    // Initialize stats with zeros
    const stats = {
      total: 0,
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      assigned_to_me: undefined as number | undefined,
      unassigned: undefined as number | undefined,
    };

    // Process status counts
    for (const statusCount of statusCounts) {
      const count = statusCount._count.id;
      stats.total += count;

      switch (statusCount.status) {
        case "open":
          stats.open = count;
          break;
        case "in_progress":
          stats.in_progress = count;
          break;
        case "resolved":
          stats.resolved = count;
          break;
        case "closed":
          stats.closed = count;
          break;
      }
    }

    // For supporters, add assignment statistics
    if (user.isSupporterFlag) {
      // Count tickets assigned to current user
      const assignedToMe = await prisma.supportTicket.count({
        where: {
          assignedTo: user.id,
        },
      });
      stats.assigned_to_me = assignedToMe;

      // Count unassigned tickets
      const unassigned = await prisma.supportTicket.count({
        where: {
          assignedTo: null,
        },
      });
      stats.unassigned = unassigned;
    }

    logger.info("Successfully fetched support ticket statistics", {
      userId: user.id,
      stats: {
        total: stats.total,
        open: stats.open,
        in_progress: stats.in_progress,
        resolved: stats.resolved,
        closed: stats.closed,
        assigned_to_me: stats.assigned_to_me,
        unassigned: stats.unassigned,
      },
    });

    const response = NextResponse.json(stats);

    // Cache for 2 minutes (stats change frequently but not constantly)
    response.headers.set("Cache-Control", "public, max-age=120");

    return response;
  } catch (error) {
    logger.error("Error fetching support ticket statistics", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: user.id,
    });
    return NextResponse.json(
      { error: { message: "Internal server error", code: 500 } },
      { status: 500 }
    );
  }
});
