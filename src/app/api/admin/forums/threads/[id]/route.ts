import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * DELETE /api/admin/forums/threads/[id] - Delete a forum thread
 */
export const DELETE = withCsrfProtection(
  withAuth(
    async (
      _request: NextRequest,
      { user },
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const resolvedParams = await params;
        const threadId = parseInt(resolvedParams.id);
        if (isNaN(threadId)) {
          return NextResponse.json(
            {
              error: {
                message: "Invalid thread ID",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        logger.info("Admin deleting forum thread", {
          threadId,
          deletedBy: user.id,
        });

        // Check if thread exists
        const existingThread = await prisma.forumThread.findUnique({
          where: { id: threadId },
        });

        if (!existingThread) {
          return NextResponse.json(
            {
              error: {
                message: "Thread not found",
                code: 404,
              },
            },
            { status: 404 }
          );
        }

        // Use transaction to delete thread and all related data
        await prisma.$transaction(async (tx) => {
          // First, delete all reports related to posts in this thread
          await tx.forumReport.deleteMany({
            where: {
              threadId: threadId,
            },
          });

          // Then delete all posts in this thread
          await tx.forumPost.deleteMany({
            where: {
              threadId: threadId,
            },
          });

          // Finally delete the thread itself
          await tx.forumThread.delete({
            where: { id: threadId },
          });
        });

        logger.info("Successfully deleted forum thread", {
          threadId,
          title: existingThread.title,
        });

        return NextResponse.json({
          message: "Thread deleted successfully",
        });
      } catch (error) {
        const resolvedParams = await params;
        logger.error("Error deleting forum thread", {
          threadId: resolvedParams.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
          {
            error: {
              message: "Failed to delete forum thread",
              code: 500,
            },
          },
          { status: 500 }
        );
      }
    },
    { requireAdmin: true }
  )
);
