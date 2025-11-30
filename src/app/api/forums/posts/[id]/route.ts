import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * PUT /api/forums/posts/[id]
 * Update a forum post (edit content)
 */
export const PUT = withAuth(
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;
    const postId = parseInt(id);

    try {
      if (isNaN(postId)) {
        return NextResponse.json(
          { error: { message: "Invalid post ID", code: 400 } },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { content } = body;

      if (
        !content ||
        typeof content !== "string" ||
        content.trim().length === 0
      ) {
        return NextResponse.json(
          { error: { message: "Content is required", code: 400 } },
          { status: 400 }
        );
      }

      logger.info(`Updating forum post ${postId}`, {
        userId: user.id,
        postId,
        contentLength: content.length,
      });

      // Find the post and verify ownership
      const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        include: {
          thread: {
            include: {
              category: {
                select: {
                  isActive: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      if (!post) {
        return NextResponse.json(
          { error: { message: "Post not found", code: 404 } },
          { status: 404 }
        );
      }

      // Check if user owns the post
      if (post.createdBy !== user.id) {
        return NextResponse.json(
          { error: { message: "You can only edit your own posts", code: 403 } },
          { status: 403 }
        );
      }

      // Check if thread is locked
      if (post.thread.isLocked) {
        return NextResponse.json(
          {
            error: { message: "Cannot edit posts in locked thread", code: 403 },
          },
          { status: 403 }
        );
      }

      // Check if category is active
      if (!post.thread.category.isActive) {
        return NextResponse.json(
          {
            error: {
              message: "Cannot edit posts in inactive category",
              code: 403,
            },
          },
          { status: 403 }
        );
      }

      // Update the post
      const updatedPost = await prisma.forumPost.update({
        where: { id: postId },
        data: {
          content: content.trim(),
          editedDate: new Date(),
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          thread: {
            select: {
              id: true,
              title: true,
              slug: true,
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      logger.info(`Successfully updated forum post ${postId}`, {
        userId: user.id,
        postId,
        threadId: post.thread.id,
        categorySlug: post.thread.category.slug,
      });

      return NextResponse.json({
        message: "Post updated successfully",
        post: updatedPost,
      });
    } catch (error) {
      logger.error(`Failed to update forum post ${postId}`, error);
      return NextResponse.json(
        { error: { message: "Internal server error", code: 500 } },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /api/forums/posts/[id]
 * Delete a forum post
 */
export const DELETE = withAuth(
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;
    const postId = parseInt(id);

    try {
      if (isNaN(postId)) {
        return NextResponse.json(
          { error: { message: "Invalid post ID", code: 400 } },
          { status: 400 }
        );
      }

      logger.info(`Deleting forum post ${postId}`, {
        userId: user.id,
        postId,
      });

      // Find the post and verify ownership
      const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        include: {
          thread: {
            include: {
              category: {
                select: {
                  isActive: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      if (!post) {
        return NextResponse.json(
          { error: { message: "Post not found", code: 404 } },
          { status: 404 }
        );
      }

      // Check if user owns the post
      if (post.createdBy !== user.id) {
        return NextResponse.json(
          {
            error: { message: "You can only delete your own posts", code: 403 },
          },
          { status: 403 }
        );
      }

      // Prevent deletion of first posts (original thread posts)
      if (post.isFirstPost) {
        return NextResponse.json(
          {
            error: {
              message: "Cannot delete the original thread post",
              code: 403,
            },
          },
          { status: 403 }
        );
      }

      // Check if thread is locked
      if (post.thread.isLocked) {
        return NextResponse.json(
          {
            error: {
              message: "Cannot delete posts in locked thread",
              code: 403,
            },
          },
          { status: 403 }
        );
      }

      // Check if category is active
      if (!post.thread.category.isActive) {
        return NextResponse.json(
          {
            error: {
              message: "Cannot delete posts in inactive category",
              code: 403,
            },
          },
          { status: 403 }
        );
      }

      // Delete the post (this will cascade delete related reports)
      await prisma.forumPost.delete({
        where: { id: postId },
      });

      logger.info(`Successfully deleted forum post ${postId}`, {
        userId: user.id,
        postId,
        threadId: post.thread.id,
        categorySlug: post.thread.category.slug,
      });

      return NextResponse.json({
        message: "Post deleted successfully",
      });
    } catch (error) {
      logger.error(`Failed to delete forum post ${postId}`, error);
      return NextResponse.json(
        { error: { message: "Internal server error", code: 500 } },
        { status: 500 }
      );
    }
  }
);
