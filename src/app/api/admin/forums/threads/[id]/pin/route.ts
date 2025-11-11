import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/forums/threads/[id]/pin - Pin/unpin a forum thread
 */
export const POST = withAuth(
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const resolvedParams = await params;
      const threadId = parseInt(resolvedParams.id);
      const body = await request.json();
      const { is_pinned = true } = body; // Default to pinning if not specified

      logger.info("Admin pinning/unpinning forum thread", {
        threadId,
        is_pinned,
        pinnedBy: user.id,
      });

      // Check if thread exists
      const existingThread = await prisma.forumThread.findUnique({
        where: { id: threadId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
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

      // Update the thread pin status
      const updatedThread = await prisma.forumThread.update({
        where: { id: threadId },
        data: {
          isPinned: is_pinned,
          updatedDate: new Date(),
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              posts: true,
              reports: true,
            },
          },
        },
      });

      // Transform response to match expected format
      const transformedThread = {
        id: updatedThread.id,
        title: updatedThread.title,
        slug: updatedThread.slug,
        is_pinned: updatedThread.isPinned,
        is_locked: updatedThread.isLocked,
        created_date:
          updatedThread.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          updatedThread.updatedDate?.toISOString() ?? new Date().toISOString(),
        category: updatedThread.category
          ? {
              id: updatedThread.category.id,
              name: updatedThread.category.name,
              slug: updatedThread.category.slug,
            }
          : null,
        creator: updatedThread.creator
          ? {
              id: updatedThread.creator.id,
              first_name: updatedThread.creator.firstName,
              last_name: updatedThread.creator.lastName,
            }
          : null,
        post_count: updatedThread._count.posts,
        report_count: updatedThread._count.reports,
      };

      const action = is_pinned ? "pinned" : "unpinned";
      logger.info(`Successfully ${action} forum thread`, {
        threadId,
        threadTitle: updatedThread.title,
      });

      return NextResponse.json({
        message: `Thread ${action} successfully`,
        thread: transformedThread,
      });
    } catch (error) {
      const resolvedParams = await params;
      logger.error("Error pinning/unpinning forum thread", {
        threadId: resolvedParams.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          error: {
            message: "Failed to pin/unpin forum thread",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
