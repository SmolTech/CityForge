import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { validateForumPost } from "@/lib/validation/forums";
import { logger } from "@/lib/logger";

/**
 * POST /api/forums/categories/[slug]/threads/[id]/posts
 * Add a new post to a thread
 */
export const POST = withCsrfProtection(
  withAuth(
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

        const body = await request.json();
        const validation = validateForumPost(body);

        if (!validation.isValid) {
          return NextResponse.json(
            {
              error: {
                message: "Validation failed",
                code: 422,
                details: validation.errors,
              },
            },
            { status: 422 }
          );
        }

        logger.info(`Creating new post in thread ${threadId}`, {
          userId: user.id,
          threadId,
          slug,
          contentLength: validation.data!.content.length,
        });

        // Verify thread exists and is in the correct category
        const thread = await prisma.forumThread.findFirst({
          where: {
            id: threadId,
            category: {
              slug: slug,
              isActive: true,
            },
          },
          select: {
            id: true,
            isLocked: true,
            category: {
              select: {
                name: true,
                slug: true,
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

        // Check if thread is locked
        if (thread.isLocked) {
          return NextResponse.json(
            { error: { message: "Thread is locked", code: 403 } },
            { status: 403 }
          );
        }

        // Create the post
        const post = await prisma.forumPost.create({
          data: {
            threadId: threadId,
            content: validation.data!.content,
            createdBy: user.id,
            isFirstPost: false, // New posts are never first posts
            reportCount: 0,
          },
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            thread: {
              select: {
                id: true,
                title: true,
                slug: true,
                categoryId: true,
              },
            },
          },
        });

        logger.info("Successfully created forum post", {
          postId: post.id,
          threadId: post.threadId,
          userId: user.id,
          categorySlug: slug,
        });

        // Transform response to match Flask API format
        const responseData = {
          id: post.id,
          thread_id: post.threadId,
          content: post.content,
          is_first_post: post.isFirstPost,
          report_count: post.reportCount,
          created_by: post.createdBy,
          created_date:
            post.createdDate?.toISOString() ?? new Date().toISOString(),
          updated_date:
            post.updatedDate?.toISOString() ?? new Date().toISOString(),
          creator: {
            id: post.creator.id,
            first_name: post.creator.firstName,
            last_name: post.creator.lastName,
          },
          thread: {
            id: post.thread.id,
            title: post.thread.title,
            slug: post.thread.slug,
            category_id: post.thread.categoryId,
          },
        };

        return NextResponse.json(
          {
            post: responseData,
            thread: {
              id: post.thread.id,
              title: post.thread.title,
              slug: post.thread.slug,
              category_id: post.thread.categoryId,
            },
          },
          { status: 201 }
        );
      } catch (error) {
        logger.error("Error creating forum post", {
          error: error instanceof Error ? error.message : "Unknown error",
          threadId: id,
          slug,
          userId: user.id,
        });
        return NextResponse.json(
          { error: { message: "Internal server error", code: 500 } },
          { status: 500 }
        );
      }
    }
  )
);
