import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/lib/auth/password";

/**
 * POST /api/admin/users/[id]/reset-password - Reset user password (admin only)
 */
export const POST = withAuth(
  async (
    request: NextRequest,
    _context,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid user ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { new_password } = body;

      if (!new_password || new_password.length < 8) {
        return NextResponse.json(
          {
            error: {
              message: "Password must be at least 8 characters long",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return NextResponse.json(
          {
            error: {
              message: "User not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // Hash new password
      const passwordHash = await hashPassword(new_password);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      return NextResponse.json({
        message: "Password reset successfully",
      });
    } catch (error) {
      logger.error("Error resetting password:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to reset password",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
