import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/forums/my?type=threads|posts&page=1&limit=20
 * Get user's own threads and posts
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "threads"; // Default to threads
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Validate type parameter
    if (!["threads", "posts"].includes(type)) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid type. Must be 'threads' or 'posts'",
            code: 400,
          },
        },
        { status: 400 }
      );
    }

    logger.info(`Getting user's forum ${type}`, {
      userId: user.id,
      type,
      page,
      limit,
    });

    if (type === "threads") {
      // Get user's threads
      const threads = await prisma.forumThread.findMany({
        where: {
          createdBy: user.id,
          category: {
            isActive: true, // Only show threads from active categories
          },
        },
        include: {
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
            select: {
              id: true,
            },
          },
          _count: {
            select: {
              posts: true,
            },
          },
        },
        orderBy: {
          updatedDate: "desc", // Most recently updated first
        },
        skip: offset,
        take: limit,
      });

      // Get total count for pagination
      const totalThreads = await prisma.forumThread.count({
        where: {
          createdBy: user.id,
          category: {
            isActive: true,
          },
        },
      });

      const totalPages = Math.ceil(totalThreads / limit);

      // Transform threads to match Flask API format
      const transformedThreads = threads.map((thread: any) => ({
        id: thread.id,
        category_id: thread.categoryId,
        title: thread.title,
        slug: thread.slug,
        is_pinned: thread.isPinned,
        is_locked: thread.isLocked,
        report_count: thread.reportCount,
        created_by: thread.createdBy,
        created_date: thread.createdDate.toISOString(),
        updated_date: thread.updatedDate.toISOString(),
        category: {
          id: thread.category.id,
          name: thread.category.name,
          slug: thread.category.slug,
          description: thread.category.description,
          is_active: thread.category.isActive,
          display_order: thread.category.displayOrder,
        },
        post_count: thread._count.posts,
      }));

      logger.info("Successfully fetched user's threads", {
        userId: user.id,
        threadCount: transformedThreads.length,
        totalThreads,
        page,
      });

      const responseData = {
        threads: transformedThreads,
        pagination: {
          page,
          limit,
          total: totalThreads,
          total_pages: totalPages,
        },
      };

      const response = NextResponse.json(responseData);
      // Cache for 2 minutes (user's own data but may change frequently)
      response.headers.set("Cache-Control", "private, max-age=120");
      return response;
    } else {
      // type === "posts"
      // Get user's posts
      const posts = await prisma.forumPost.findMany({
        where: {
          createdBy: user.id,
          thread: {
            category: {
              isActive: true, // Only show posts from active categories
            },
          },
        },
        include: {
          thread: {
            select: {
              id: true,
              title: true,
              slug: true,
              categoryId: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdDate: "desc", // Most recent posts first
        },
        skip: offset,
        take: limit,
      });

      // Get total count for pagination
      const totalPosts = await prisma.forumPost.count({
        where: {
          createdBy: user.id,
          thread: {
            category: {
              isActive: true,
            },
          },
        },
      });

      const totalPages = Math.ceil(totalPosts / limit);

      // Transform posts to match Flask API format
      const transformedPosts = posts.map((post: any) => ({
        id: post.id,
        thread_id: post.threadId,
        content: post.content,
        is_first_post: post.isFirstPost,
        report_count: post.reportCount,
        created_by: post.createdBy,
        created_date: post.createdDate.toISOString(),
        updated_date: post.updatedDate.toISOString(),
        edited_by: post.editedBy,
        edited_date: post.editedDate?.toISOString() || null,
        thread: {
          id: post.thread.id,
          title: post.thread.title,
          slug: post.thread.slug,
          category_id: post.thread.categoryId,
          category: {
            id: post.thread.category.id,
            name: post.thread.category.name,
            slug: post.thread.category.slug,
          },
        },
      }));

      logger.info("Successfully fetched user's posts", {
        userId: user.id,
        postCount: transformedPosts.length,
        totalPosts,
        page,
      });

      const responseData = {
        posts: transformedPosts,
        pagination: {
          page,
          limit,
          total: totalPosts,
          total_pages: totalPages,
        },
      };

      const response = NextResponse.json(responseData);
      // Cache for 2 minutes (user's own data but may change frequently)
      response.headers.set("Cache-Control", "private, max-age=120");
      return response;
    }
  } catch (error) {
    logger.error("Error fetching user's forum content", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: user.id,
      type: new URL(request.url).searchParams.get("type"),
    });
    return NextResponse.json(
      { error: { message: "Internal server error", code: 500 } },
      { status: 500 }
    );
  }
});
