import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { withAuthRateLimit } from "@/lib/auth/rateLimit";
import { logger } from "@/lib/logger";
import { generateSecureToken, getEmailService } from "@/lib/email";
import { sendPasswordResetWebhook } from "@/lib/webhooks";

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 */
export const POST = withAuthRateLimit(
  "forgot-password",
  async function forgotPasswordHandler(request: NextRequest) {
    try {
      const body = await request.json();
      const { email } = body;

      // Validate email
      if (!email || typeof email !== "string") {
        throw new ApiError("Email is required", 422, "VALIDATION_ERROR");
      }

      // Normalize email to lowercase
      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });

      // For security, always return success even if user doesn't exist
      // This prevents email enumeration attacks
      if (!user) {
        logger.info("Password reset requested for non-existent email", {
          email: normalizedEmail,
        });
        return NextResponse.json(
          {
            message:
              "If an account exists with that email, a password reset link has been sent.",
          },
          { status: 200 }
        );
      }

      // Check if user account is active
      if (!user.isActive) {
        logger.warn("Password reset requested for inactive account", {
          userId: user.id,
          email: normalizedEmail,
        });
        return NextResponse.json(
          {
            message:
              "If an account exists with that email, a password reset link has been sent.",
          },
          { status: 200 }
        );
      }

      // Generate secure reset token
      const resetToken = generateSecureToken(32);

      // Token expires in 1 hour
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Invalidate any existing unused tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          used: false,
          expiresAt: { gt: new Date() },
        },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });

      // Create new reset token
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt,
        },
      });

      // Generate reset URL
      const siteUrl =
        process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";
      const resetUrl = `${siteUrl}/reset-password?token=${resetToken}`;

      // Send password reset email
      const emailService = getEmailService();
      if (emailService) {
        try {
          // Send webhook first (non-blocking)
          try {
            await sendPasswordResetWebhook(
              user.email,
              resetToken,
              expiresAt,
              `${user.firstName} ${user.lastName}`
            );
          } catch (webhookError) {
            logger.error("Failed to send password reset webhook", {
              userId: user.id,
              email: user.email,
              error: webhookError,
            });
          }

          await emailService.sendPasswordResetEmail(
            user.email,
            resetUrl,
            `${user.firstName} ${user.lastName}`
          );
          logger.info("Password reset email sent", {
            userId: user.id,
            email: user.email,
          });
        } catch (error) {
          logger.error("Failed to send password reset email", {
            userId: user.id,
            email: user.email,
            error,
          });
          // Continue - don't reveal email sending failure to user
        }
      } else {
        // Development mode - log the reset URL
        logger.info("Password reset URL (email service not configured)", {
          email: user.email,
          resetUrl,
        });
        console.log("\n🔗 Password Reset Link:", resetUrl, "\n");
      }

      return NextResponse.json(
        {
          message:
            "If an account exists with that email, a password reset link has been sent.",
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

      logger.error("Forgot password error", error);
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
