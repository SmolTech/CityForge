import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedUser } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import {
  handleApiError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// Validation helper for comments
function validateComment(data: Record<string, unknown>) {
  const errors: string[] = [];

  if (
    !data["content"] ||
    typeof data["content"] !== "string" ||
    data["content"].trim().length === 0
  ) {
    errors.push("Content is required");
  }

  if (data["parent_id"] !== undefined && data["parent_id"] !== null) {
    const parentId = parseInt(String(data["parent_id"]));
    if (isNaN(parentId)) {
      errors.push("Invalid parent_id");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data:
      errors.length === 0
        ? {
            content: (data["content"] as string).trim(),
            parent_id: data["parent_id"]
              ? parseInt(String(data["parent_id"]))
              : null,
          }
        : null,
  };
}

// GET /api/help-wanted/[id]/comments - Get comments for a help wanted post
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);

    if (isNaN(postId)) {
      throw new BadRequestError("Invalid post ID");
    }

    // Check if post exists
    const post = await prisma.helpWantedPost.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundError("Help wanted post not found");
    }

    // Get comments with replies
    const comments = await prisma.helpWantedComment.findMany({
      where: {
        postId: postId,
        parentId: null, // Only top-level comments
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: {
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
      orderBy: {
        createdDate: "asc",
      },
    });

    // Transform comments
    const transformedComments = comments.map((comment) => ({
      id: comment.id,
      post_id: comment.postId,
      content: comment.content,
      parent_id: comment.parentId,
      created_date: comment.createdDate?.toISOString(),
      updated_date: comment.updatedDate?.toISOString(),
      creator: comment.creator
        ? {
            id: comment.creator.id,
            first_name: comment.creator.firstName,
            last_name: comment.creator.lastName,
          }
        : undefined,
      replies: comment.replies.map((reply) => ({
        id: reply.id,
        post_id: reply.postId,
        content: reply.content,
        parent_id: reply.parentId,
        created_date: reply.createdDate?.toISOString(),
        updated_date: reply.updatedDate?.toISOString(),
        creator: reply.creator
          ? {
              id: reply.creator.id,
              first_name: reply.creator.firstName,
              last_name: reply.creator.lastName,
            }
          : undefined,
      })),
    }));

    return NextResponse.json(transformedComments);
  } catch (error: unknown) {
    return handleApiError(error, "GET /api/help-wanted/[id]/comments");
  }
}

// POST /api/help-wanted/[id]/comments - Create a new comment
export const POST = withCsrfProtection(
  withAuth(
    async (
      request: NextRequest,
      { user }: { user: AuthenticatedUser },
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const { id } = await params;
        const postId = parseInt(id);

        if (isNaN(postId)) {
          throw new BadRequestError("Invalid post ID");
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
        const validation = validateComment(data);
        if (!validation.isValid) {
          throw new ValidationError("Validation failed", {
            errors: validation.errors,
          });
        }

        if (!validation.data) {
          throw new BadRequestError("Validation failed - no data");
        }

        // Check if post exists
        const post = await prisma.helpWantedPost.findUnique({
          where: { id: postId },
          select: { id: true },
        });

        if (!post) {
          throw new NotFoundError("Help wanted post not found");
        }

        // If parent_id is provided, check if parent comment exists and belongs to the same post
        if (validation.data.parent_id) {
          const parentComment = await prisma.helpWantedComment.findUnique({
            where: { id: validation.data.parent_id },
            select: { postId: true },
          });

          if (!parentComment || parentComment.postId !== postId) {
            throw new BadRequestError("Invalid parent comment");
          }
        }

        // Create comment
        const comment = await prisma.helpWantedComment.create({
          data: {
            postId: postId,
            content: validation.data.content,
            parentId: validation.data.parent_id,
            createdBy: user.id,
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
          id: comment.id,
          post_id: comment.postId,
          content: comment.content,
          parent_id: comment.parentId,
          created_date: comment.createdDate?.toISOString(),
          updated_date: comment.updatedDate?.toISOString(),
          creator: comment.creator
            ? {
                id: comment.creator.id,
                first_name: comment.creator.firstName,
                last_name: comment.creator.lastName,
              }
            : undefined,
        };

        return NextResponse.json(transformedComment, { status: 201 });
      } catch (error: unknown) {
        return handleApiError(error, "POST /api/help-wanted/[id]/comments");
      }
    }
  )
);
