import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedUser } from "@/lib/auth/middleware";
import {
  handleApiError,
  BadRequestError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// Validation helper for comment updates
function validateCommentUpdate(data: Record<string, unknown>) {
  const errors: string[] = [];

  if (
    !data["content"] ||
    typeof data["content"] !== "string" ||
    data["content"].trim().length === 0
  ) {
    errors.push("Content is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data:
      errors.length === 0
        ? {
            content: (data["content"] as string).trim(),
          }
        : null,
  };
}

// PUT /api/help-wanted/[id]/comments/[commentId] - Update a comment
export const PUT = withAuth(
  async (
    request: NextRequest,
    { user }: { user: AuthenticatedUser },
    { params }: { params: Promise<{ id: string; commentId: string }> }
  ) => {
    try {
      const { id, commentId } = await params;
      const postId = parseInt(id);
      const commentIdNum = parseInt(commentId);

      if (isNaN(postId) || isNaN(commentIdNum)) {
        throw new BadRequestError("Invalid post ID or comment ID");
      }

      // Parse request body
      let data;
      try {
        data = await request.json();
      } catch {
        throw new BadRequestError("No data provided");
      }

      if (!data) {
        throw new BadRequestError("No data provided");
      }

      // Validate input data
      const validation = validateCommentUpdate(data);
      if (!validation.isValid) {
        throw new ValidationError("Validation failed", {
          errors: validation.errors,
        });
      }

      if (!validation.data) {
        throw new BadRequestError("Validation failed - no data");
      }

      // Check if comment exists and belongs to the post and user
      const existingComment = await prisma.helpWantedComment.findUnique({
        where: { id: commentIdNum },
        select: {
          postId: true,
          createdBy: true,
        },
      });

      if (!existingComment) {
        throw new NotFoundError("Comment not found");
      }

      if (existingComment.postId !== postId) {
        throw new BadRequestError("Comment does not belong to this post");
      }

      if (existingComment.createdBy !== user.id) {
        throw new ForbiddenError("You can only edit your own comments");
      }

      // Update comment
      const updatedComment = await prisma.helpWantedComment.update({
        where: { id: commentIdNum },
        data: {
          content: validation.data.content,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Transform data to match the expected API format
      const transformedComment = {
        id: updatedComment.id,
        post_id: updatedComment.postId,
        content: updatedComment.content,
        parent_id: updatedComment.parentId,
        created_date: updatedComment.createdDate?.toISOString(),
        updated_date: updatedComment.updatedDate?.toISOString(),
        creator: updatedComment.creator
          ? {
              id: updatedComment.creator.id,
              first_name: updatedComment.creator.firstName,
              last_name: updatedComment.creator.lastName,
            }
          : undefined,
      };

      return NextResponse.json(transformedComment);
    } catch (error: unknown) {
      return handleApiError(
        error,
        "PUT /api/help-wanted/[id]/comments/[commentId]"
      );
    }
  }
);

// DELETE /api/help-wanted/[id]/comments/[commentId] - Delete a comment
export const DELETE = withAuth(
  async (
    _request: NextRequest,
    { user }: { user: AuthenticatedUser },
    { params }: { params: Promise<{ id: string; commentId: string }> }
  ) => {
    try {
      const { id, commentId } = await params;
      const postId = parseInt(id);
      const commentIdNum = parseInt(commentId);

      if (isNaN(postId) || isNaN(commentIdNum)) {
        throw new BadRequestError("Invalid post ID or comment ID");
      }

      // Check if comment exists and belongs to the post and user
      const existingComment = await prisma.helpWantedComment.findUnique({
        where: { id: commentIdNum },
        select: {
          postId: true,
          createdBy: true,
        },
      });

      if (!existingComment) {
        throw new NotFoundError("Comment not found");
      }

      if (existingComment.postId !== postId) {
        throw new BadRequestError("Comment does not belong to this post");
      }

      if (existingComment.createdBy !== user.id) {
        throw new ForbiddenError("You can only delete your own comments");
      }

      // Delete the comment (this will cascade to replies)
      await prisma.helpWantedComment.delete({
        where: { id: commentIdNum },
      });

      return NextResponse.json({ message: "Comment deleted successfully" });
    } catch (error: unknown) {
      return handleApiError(
        error,
        "DELETE /api/help-wanted/[id]/comments/[commentId]"
      );
    }
  }
);
