import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/forums/categories/[slug]/threads/[id]
 * Get a specific thread with all its posts
 */
export const GET = withAuth(
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ slug: string; id: string }> }
  ) => {
    const { slug, id } = await params;
    const threadId = parseInt(id);

    try {
      if (isNaN(threadId)) {
        return NextResponse.json(
          { error: { message: "Invalid thread ID", code: 400 } },
          { status: 400 }
        );
      }

      logger.info(`Getting thread ${threadId} in category ${slug}`, {
        userId: user.id,
        threadId,
        slug,
      });

      // Get the thread with all related data
      const thread = await prisma.forumThread.findFirst({
        where: {
          id: threadId,
          category: {
            slug: slug,
            isActive: true,
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              isActive: true,
              displayOrder: true,
            },
          },
          posts: {
            include: {
              creator: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: {
              createdDate: "asc",
            },
          },
        },
      });

      if (!thread) {
        return NextResponse.json(
          { error: { message: "Thread not found", code: 404 } },
          { status: 404 }
        );
      }

      // Transform posts to match Flask API format
      const transformedPosts = thread.posts.map((post: any) => ({
        id: post.id,
        thread_id: post.threadId,
        content: post.content,
        is_first_post: post.isFirstPost,
        report_count: post.reportCount,
        created_by: post.createdBy,
        created_date:
          post.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          post.updatedDate?.toISOString() ??
          post.createdDate?.toISOString() ??
          new Date().toISOString(),
        creator: {
          id: post.creator.id,
          first_name: post.creator.firstName,
          last_name: post.creator.lastName,
        },
      }));

      // Transform thread to match Flask API format
      const responseData = {
        id: thread.id,
        category_id: thread.categoryId,
        title: thread.title,
        slug: thread.slug,
        is_pinned: thread.isPinned,
        is_locked: thread.isLocked,
        report_count: thread.reportCount,
        created_by: thread.createdBy,
        created_date:
          thread.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          thread.updatedDate?.toISOString() ?? new Date().toISOString(),
        creator: {
          id: thread.creator.id,
          first_name: thread.creator.firstName,
          last_name: thread.creator.lastName,
        },
        category: {
          id: thread.category.id,
          name: thread.category.name,
          slug: thread.category.slug,
          description: thread.category.description,
          is_active: thread.category.isActive,
          display_order: thread.category.displayOrder,
        },
        posts: transformedPosts,
        post_count: transformedPosts.length,
      };

      logger.info("Successfully fetched thread with posts", {
        threadId: thread.id,
        postCount: transformedPosts.length,
        categorySlug: slug,
      });

      const response = NextResponse.json(responseData);

      // Cache for 2 minutes (individual threads are viewed frequently)
      response.headers.set("Cache-Control", "public, max-age=120");

      return response;
    } catch (error) {
      logger.error("Error fetching thread", {
        error: error instanceof Error ? error.message : "Unknown error",
        threadId: id,
        slug,
      });
      return NextResponse.json(
        { error: { message: "Internal server error", code: 500 } },
        { status: 500 }
      );
    }
  }
);
