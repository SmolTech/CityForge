import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedUser } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import {
  handleApiError,
  BadRequestError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// Validation helper for help wanted post updates
function validateHelpWantedPostUpdate(data: Record<string, unknown>) {
  const errors: string[] = [];

  if (data["title"] !== undefined) {
    if (
      typeof data["title"] !== "string" ||
      data["title"].trim().length === 0
    ) {
      errors.push("Title cannot be empty");
    } else if (data["title"].length > 255) {
      errors.push("Title must be 255 characters or less");
    }
  }

  if (data["description"] !== undefined) {
    if (
      typeof data["description"] !== "string" ||
      data["description"].trim().length === 0
    ) {
      errors.push("Description cannot be empty");
    }
  }

  if (data["category"] !== undefined) {
    const validCategories = ["hiring", "collaboration", "general"];
    if (!validCategories.includes(data["category"] as string)) {
      errors.push("Category must be one of: hiring, collaboration, general");
    }
  }

  if (data["status"] !== undefined) {
    const validStatuses = ["open", "closed"];
    if (!validStatuses.includes(data["status"] as string)) {
      errors.push("Status must be one of: open, closed");
    }
  }

  if (
    data["location"] !== undefined &&
    data["location"] &&
    typeof data["location"] === "string" &&
    data["location"].length > 255
  ) {
    errors.push("Location must be 255 characters or less");
  }

  if (
    data["budget"] !== undefined &&
    data["budget"] &&
    typeof data["budget"] === "string" &&
    data["budget"].length > 100
  ) {
    errors.push("Budget must be 100 characters or less");
  }

  if (
    data["contact_preference"] !== undefined &&
    data["contact_preference"] &&
    typeof data["contact_preference"] === "string" &&
    data["contact_preference"].length > 50
  ) {
    errors.push("Contact preference must be 50 characters or less");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// GET /api/help-wanted/[id] - Get a specific help wanted post
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

    const post = await prisma.helpWantedPost.findUnique({
      where: { id: postId },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        comments: {
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
          where: {
            parentId: null, // Only get top-level comments
          },
          orderBy: {
            createdDate: "asc",
          },
        },
        _count: {
          select: {
            comments: true,
            reports: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundError("Help wanted post");
    }

    // Transform comments
    const transformedComments = post.comments.map((comment) => ({
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

    // Transform data to match the expected API format
    const transformedPost = {
      id: post.id,
      title: post.title,
      description: post.description,
      category: post.category,
      status: post.status,
      location: post.location,
      budget: post.budget,
      contact_preference: post.contactPreference,
      report_count: post._count.reports,
      created_date: post.createdDate?.toISOString(),
      updated_date: post.updatedDate?.toISOString(),
      creator: post.creator
        ? {
            id: post.creator.id,
            first_name: post.creator.firstName,
            last_name: post.creator.lastName,
            email: post.creator.email,
          }
        : undefined,
      comment_count: post._count.comments,
      comments: transformedComments,
    };

    return NextResponse.json(transformedPost);
  } catch (error: unknown) {
    return handleApiError(error, "GET /api/help-wanted/[id]");
  }
}

// PUT /api/help-wanted/[id] - Update a help wanted post
export const PUT = withCsrfProtection(
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
        const validation = validateHelpWantedPostUpdate(data);
        if (!validation.isValid) {
          throw new ValidationError(validation.errors.join(". "), {
            errors: validation.errors,
          });
        }

        // Check if post exists and user owns it
        const existingPost = await prisma.helpWantedPost.findUnique({
          where: { id: postId },
          select: { createdBy: true },
        });

        if (!existingPost) {
          throw new NotFoundError("Help wanted post");
        }

        if (existingPost.createdBy !== user.id && user.role !== "admin") {
          throw new ForbiddenError("You can only edit your own posts");
        }

        // Prepare update data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {}; // Using any for dynamic property assignment

        if (data["title"] !== undefined && typeof data["title"] === "string")
          updateData.title = data["title"].trim();
        if (
          data["description"] !== undefined &&
          typeof data["description"] === "string"
        )
          updateData.description = data["description"].trim();
        if (data["category"] !== undefined)
          updateData.category = data["category"];
        if (data["status"] !== undefined) updateData.status = data["status"];
        if (data["location"] !== undefined)
          updateData.location =
            typeof data["location"] === "string"
              ? data["location"].trim()
              : null;
        if (data["budget"] !== undefined)
          updateData.budget =
            typeof data["budget"] === "string" ? data["budget"].trim() : null;
        if (data["contact_preference"] !== undefined)
          updateData.contactPreference =
            typeof data["contact_preference"] === "string"
              ? data["contact_preference"].trim()
              : null;

        // Update help wanted post in database
        const updatedPost = await prisma.helpWantedPost.update({
          where: { id: postId },
          data: updateData,
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                comments: true,
                reports: true,
              },
            },
          },
        });

        // Transform data to match the expected API format
        const transformedPost = {
          id: updatedPost.id,
          title: updatedPost.title,
          description: updatedPost.description,
          category: updatedPost.category,
          status: updatedPost.status,
          location: updatedPost.location,
          budget: updatedPost.budget,
          contact_preference: updatedPost.contactPreference,
          report_count: updatedPost._count.reports,
          created_date: updatedPost.createdDate?.toISOString(),
          updated_date: updatedPost.updatedDate?.toISOString(),
          creator: updatedPost.creator
            ? {
                id: updatedPost.creator.id,
                first_name: updatedPost.creator.firstName,
                last_name: updatedPost.creator.lastName,
                email: updatedPost.creator.email,
              }
            : undefined,
          comment_count: updatedPost._count.comments,
        };

        return NextResponse.json(transformedPost);
      } catch (error: unknown) {
        return handleApiError(error, "PUT /api/help-wanted/[id]");
      }
    }
  )
);

// DELETE /api/help-wanted/[id] - Delete a help wanted post
export const DELETE = withCsrfProtection(
  withAuth(
    async (
      _request: NextRequest,
      { user }: { user: AuthenticatedUser },
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const { id } = await params;
        const postId = parseInt(id);

        if (isNaN(postId)) {
          throw new BadRequestError("Invalid post ID");
        }

        // Check if post exists and user owns it
        const existingPost = await prisma.helpWantedPost.findUnique({
          where: { id: postId },
          select: { createdBy: true },
        });

        if (!existingPost) {
          throw new NotFoundError("Help wanted post");
        }

        if (existingPost.createdBy !== user.id && user.role !== "admin") {
          throw new ForbiddenError("You can only delete your own posts");
        }

        // Delete the post using transaction for cascade delete with counts
        const result = await prisma.$transaction(async (tx) => {
          // Delete related comments first and count them
          const deletedComments = await tx.helpWantedComment.deleteMany({
            where: { postId: postId },
          });

          // Delete related reports and count them
          const deletedReports = await tx.helpWantedReport.deleteMany({
            where: { postId: postId },
          });

          // Finally delete the post itself
          await tx.helpWantedPost.delete({
            where: { id: postId },
          });

          return {
            comments: deletedComments.count,
            reports: deletedReports.count,
          };
        });

        return NextResponse.json({
          message: "Help wanted post deleted successfully",
          deletedCounts: result,
        });
      } catch (error: unknown) {
        return handleApiError(error, "DELETE /api/help-wanted/[id]");
      }
    }
  )
);
