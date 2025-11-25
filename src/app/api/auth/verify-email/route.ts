import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/auth/email-verification";
import { withAuthRateLimit } from "@/lib/auth/rateLimit";
import { logger } from "@/lib/logger";
import { handleApiError, ValidationError } from "@/lib/errors";

export const POST = withAuthRateLimit(
  "verify-email",
  async function verifyEmailHandler(request: NextRequest) {
    try {
      const { token } = await request.json();

      if (!token) {
        throw new ValidationError("Verification token is required");
      }

      const success = await verifyEmailToken(token);

      if (success) {
        logger.info("Email verification successful", {
          token: token.substring(0, 8) + "...",
        });

        return NextResponse.json({
          message: "Email verified successfully",
        });
      } else {
        logger.warn("Email verification failed", {
          token: token.substring(0, 8) + "...",
        });

        return NextResponse.json(
          {
            error: {
              message: "Invalid or expired verification token",
              code: 400,
            },
          },
          { status: 400 }
        );
      }
    } catch (error) {
      return handleApiError(error, "POST /api/auth/verify-email");
    }
  }
);
