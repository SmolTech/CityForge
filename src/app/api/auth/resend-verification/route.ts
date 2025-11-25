import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuthRateLimit } from "@/lib/auth/rateLimit";
import {
  createEmailVerificationToken,
  sendVerificationEmail,
} from "@/lib/auth/email-verification";
import { logger } from "@/lib/logger";
import {
  handleApiError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "@/lib/errors";

export const POST = withAuthRateLimit(
  "resend-verification",
  async function resendVerificationHandler(request: NextRequest) {
    try {
      const { email } = await request.json();

      if (!email) {
        throw new ValidationError("Email is required");
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          emailVerificationSentAt: true,
        },
      });

      if (!user) {
        throw new NotFoundError("User not found");
      }

      if (user.emailVerified) {
        throw new ConflictError("Email is already verified");
      }

      // Rate limiting: Don't allow resending within 5 minutes
      if (user.emailVerificationSentAt) {
        const timeSinceLastSent =
          Date.now() - user.emailVerificationSentAt.getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (timeSinceLastSent < fiveMinutes) {
          const remainingTime = Math.ceil(
            (fiveMinutes - timeSinceLastSent) / 1000 / 60
          );
          return NextResponse.json(
            {
              error: {
                message: `Please wait ${remainingTime} minute(s) before requesting another verification email`,
                code: 429,
              },
            },
            { status: 429 }
          );
        }
      }

      // Generate new verification token
      const token = await createEmailVerificationToken(user.id);

      // Send verification email
      await sendVerificationEmail(
        user.email,
        token,
        `${user.firstName} ${user.lastName}`
      );

      logger.info("Verification email resent", { email: user.email });

      return NextResponse.json({
        message: "Verification email sent successfully",
      });
    } catch (error) {
      return handleApiError(error, "POST /api/auth/resend-verification");
    }
  }
);
