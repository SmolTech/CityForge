import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { withAuthRateLimit } from "@/lib/auth/rateLimit";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/lib/auth/password";
import { validatePasswordStrength } from "@/lib/auth/validation";

/**
 * POST /api/auth/reset-password
 * Reset password using a valid token
 */
export const POST = withAuthRateLimit(
  "reset-password",
  async function resetPasswordHandler(request: NextRequest) {
    try {
      const body = await request.json();
      const { token, password } = body;

      // Validate inputs
      if (!token || typeof token !== "string") {
        throw new ApiError("Reset token is required", 422, "VALIDATION_ERROR");
      }

      if (!password || typeof password !== "string") {
        throw new ApiError("Password is required", 422, "VALIDATION_ERROR");
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        throw new ApiError(
          passwordValidation.errors.join(", "),
          422,
          "VALIDATION_ERROR",
          { password: passwordValidation.errors }
        );
      }

      // Find the reset token
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
            },
          },
        },
      });

      // Validate token exists
      if (!resetToken) {
        logger.warn("Invalid password reset token attempted", { token });
        throw new ApiError(
          "Invalid or expired reset token",
          400,
          "INVALID_TOKEN"
        );
      }

      // Check if token has been used
      if (resetToken.used) {
        logger.warn("Used password reset token attempted", {
          tokenId: resetToken.id,
          userId: resetToken.userId,
        });
        throw new ApiError(
          "This reset link has already been used",
          400,
          "TOKEN_ALREADY_USED"
        );
      }

      // Check if token has expired
      if (resetToken.expiresAt < new Date()) {
        logger.warn("Expired password reset token attempted", {
          tokenId: resetToken.id,
          userId: resetToken.userId,
          expiresAt: resetToken.expiresAt,
        });
        throw new ApiError(
          "This reset link has expired. Please request a new one.",
          400,
          "TOKEN_EXPIRED"
        );
      }

      // Check if user is active
      if (!resetToken.user.isActive) {
        logger.warn("Password reset attempted for inactive user", {
          userId: resetToken.userId,
        });
        throw new ApiError(
          "Account is not active. Please contact support.",
          403,
          "ACCOUNT_INACTIVE"
        );
      }

      // Hash the new password
      const passwordHash = await hashPassword(password);

      // Update user password and mark token as used in a transaction
      await prisma.$transaction([
        // Update user password
        prisma.user.update({
          where: { id: resetToken.userId },
          data: {
            passwordHash,
          },
        }),
        // Mark token as used
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: {
            used: true,
            usedAt: new Date(),
          },
        }),
        // Invalidate any other unused tokens for this user
        prisma.passwordResetToken.updateMany({
          where: {
            userId: resetToken.userId,
            used: false,
            id: { not: resetToken.id },
          },
          data: {
            used: true,
            usedAt: new Date(),
          },
        }),
      ]);

      logger.info("Password reset successful", {
        userId: resetToken.userId,
        email: resetToken.user.email,
      });

      return NextResponse.json(
        {
          message: "Password has been reset successfully. You can now log in.",
        },
        { status: 200 }
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            error: {
              message: error.message,
              code: error.code,
              details: error.details,
            },
          },
          { status: error.statusCode }
        );
      }

      logger.error("Reset password error", error);
      return NextResponse.json(
        {
          error: {
            message: "An error occurred processing your request",
            code: "INTERNAL_ERROR",
          },
        },
        { status: 500 }
      );
    }
  }
);

/**
 * GET /api/auth/reset-password?token=xxx
 * Validate a reset token without using it
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      throw new ApiError("Reset token is required", 422, "VALIDATION_ERROR");
    }

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: {
        id: true,
        used: true,
        expiresAt: true,
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
    });

    // Validate token
    if (!resetToken) {
      return NextResponse.json(
        {
          valid: false,
          error: "Invalid or expired reset token",
        },
        { status: 200 }
      );
    }

    if (resetToken.used) {
      return NextResponse.json(
        {
          valid: false,
          error: "This reset link has already been used",
        },
        { status: 200 }
      );
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        {
          valid: false,
          error: "This reset link has expired",
        },
        { status: 200 }
      );
    }

    if (!resetToken.user.isActive) {
      return NextResponse.json(
        {
          valid: false,
          error: "Account is not active",
        },
        { status: 200 }
      );
    }

    // Token is valid
    return NextResponse.json(
      {
        valid: true,
        email: resetToken.user.email,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
        },
        { status: error.statusCode }
      );
    }

    logger.error("Validate reset token error", error);
    return NextResponse.json(
      {
        error: {
          message: "An error occurred processing your request",
          code: "INTERNAL_ERROR",
        },
      },
      { status: 500 }
    );
  }
}
