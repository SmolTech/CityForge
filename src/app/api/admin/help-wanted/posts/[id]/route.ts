import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { handleApiError, BadRequestError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// DELETE /api/admin/help-wanted/posts/[id] - Delete a help wanted post (admin)
export const DELETE = withAuth(
  async (
    _request: NextRequest,
    _context: unknown,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const postId = parseInt(id);

      if (isNaN(postId)) {
        throw new BadRequestError("Invalid post ID");
      }

      // Check if post exists
      const existingPost = await prisma.helpWantedPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });

      if (!existingPost) {
        throw new NotFoundError("Help wanted post not found");
      }

      // Delete the post (this will cascade to comments and reports)
      await prisma.helpWantedPost.delete({
        where: { id: postId },
      });

      return NextResponse.json({
        message: "Help wanted post deleted successfully",
      });
    } catch (error) {
      return handleApiError(error, "DELETE /api/admin/help-wanted/posts/[id]");
    }
  },
  { requireAdmin: true }
);
