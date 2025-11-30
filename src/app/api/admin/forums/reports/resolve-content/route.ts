import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/forums/reports/resolve-content - Resolve all reports for a thread or post
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      const body = await request.json();
      const { type, contentId, action, notes } = body;

      // Validate input
      if (!type || !contentId || !action) {
        return NextResponse.json(
          {
            error: {
              message: "Missing required fields: type, contentId, action",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Validate type
      if (!["thread", "post"].includes(type)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid type. Must be 'thread' or 'post'",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Validate action
      const validActions = ["dismiss", "delete_post", "delete_thread"];
      if (!validActions.includes(action)) {
        return NextResponse.json(
          {
            error: {
              message:
                "Invalid action. Must be one of: dismiss, delete_post, delete_thread",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      logger.info("Admin resolving aggregated forum reports", {
        type,
        contentId,
        action,
        notes,
        reviewedBy: user.id,
      });

      // Perform the action in a transaction
      const result = await prisma.$transaction(async (tx) => {
        let whereClause;
        let reportCount = 0;

        // Determine which reports to resolve
        if (type === "thread") {
          whereClause = { threadId: parseInt(contentId), status: "pending" };

          // Get the thread and its current report count
          const thread = await tx.forumThread.findUnique({
            where: { id: parseInt(contentId) },
            select: { reportCount: true },
          });
          reportCount = thread?.reportCount || 0;
        } else {
          whereClause = { postId: parseInt(contentId), status: "pending" };

          // Get the post and its current report count
          const post = await tx.forumPost.findUnique({
            where: { id: parseInt(contentId) },
            select: { reportCount: true },
          });
          reportCount = post?.reportCount || 0;
        }

        // Get all pending reports for this content
        const pendingReports = await tx.forumReport.findMany({
          where: whereClause,
        });

        if (pendingReports.length === 0) {
          throw new Error(`No pending reports found for ${type} ${contentId}`);
        }

        // Update all pending reports to resolved
        await tx.forumReport.updateMany({
          where: whereClause,
          data: {
            status: "resolved",
            reviewedBy: user.id,
            reviewedDate: new Date(),
            resolutionNotes: notes || null,
          },
        });

        // Perform the requested action
        if (action === "delete_post" && type === "post") {
          // Reset report count to 0 for the post before deletion
          await tx.forumPost.update({
            where: { id: parseInt(contentId) },
            data: { reportCount: 0 },
          });

          // Delete the post
          await tx.forumPost.delete({
            where: { id: parseInt(contentId) },
          });
        } else if (action === "delete_thread" && type === "thread") {
          // Reset report counts to 0 for thread and all its posts before deletion
          await tx.forumPost.updateMany({
            where: { threadId: parseInt(contentId) },
            data: { reportCount: 0 },
          });

          await tx.forumThread.update({
            where: { id: parseInt(contentId) },
            data: { reportCount: 0 },
          });

          // Delete all posts in the thread first, then the thread
          await tx.forumPost.deleteMany({
            where: { threadId: parseInt(contentId) },
          });
          await tx.forumThread.delete({
            where: { id: parseInt(contentId) },
          });
        } else if (action === "dismiss") {
          // For dismiss, reset the report count to 0
          if (type === "thread") {
            await tx.forumThread.update({
              where: { id: parseInt(contentId) },
              data: { reportCount: 0 },
            });
          } else {
            await tx.forumPost.update({
              where: { id: parseInt(contentId) },
              data: { reportCount: 0 },
            });
          }
        }

        return {
          resolvedReportCount: pendingReports.length,
          originalReportCount: reportCount,
        };
      });

      let message = `Resolved ${result.resolvedReportCount} reports for ${type}`;
      if (action === "delete_post") {
        message = `Resolved ${result.resolvedReportCount} reports and deleted post`;
      } else if (action === "delete_thread") {
        message = `Resolved ${result.resolvedReportCount} reports and deleted thread`;
      } else if (action === "dismiss") {
        message = `Dismissed ${result.resolvedReportCount} reports for ${type}`;
      }

      logger.info("Successfully resolved aggregated forum reports", {
        type,
        contentId,
        action,
        resolvedCount: result.resolvedReportCount,
        originalReportCount: result.originalReportCount,
      });

      return NextResponse.json({
        message,
        resolvedReportCount: result.resolvedReportCount,
        type,
        contentId,
        action,
      });
    } catch (error) {
      logger.error("Error resolving aggregated forum reports", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          error: {
            message:
              error instanceof Error
                ? error.message
                : "Failed to resolve forum reports",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
