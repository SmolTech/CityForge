import { NextRequest, NextResponse } from "next/server";
import { reviewQueries } from "@/lib/db/queries";
import { validateReviewReport } from "@/lib/validation/reviews";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/reviews/[id]/report
 * Report a review for inappropriate content
 * Requires authentication
 */
export const POST = withCsrfProtection(
  withAuth(async (request: NextRequest, { user }, context: RouteContext) => {
    try {
      const params = await context.params;
      const reviewId = parseInt(params.id);

      // Validate review ID
      if (isNaN(reviewId) || reviewId <= 0) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid review ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Get existing review
      const review = await reviewQueries.getReviewById(reviewId);
      if (!review) {
        return NextResponse.json(
          {
            error: {
              message: "Review not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // Check if review is already reported
      if (review.reported) {
        return NextResponse.json(
          {
            error: {
              message: "This review has already been reported",
              code: 409,
            },
          },
          { status: 409 }
        );
      }

      // Users cannot report their own reviews
      if (review.userId === user.id) {
        return NextResponse.json(
          {
            error: {
              message: "You cannot report your own review",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Parse and validate request data
      const body = await request.json();
      const validation = validateReviewReport(body);

      if (!validation.isValid) {
        return NextResponse.json(
          {
            error: {
              message: "Validation failed",
              code: 422,
              details: validation.errors,
            },
          },
          { status: 422 }
        );
      }

      // Report the review
      await reviewQueries.reportReview(
        reviewId,
        user.id,
        validation.data!.reason,
        validation.data!.details
      );

      logger.info("Review reported", {
        reviewId,
        reporterId: user.id,
        reason: validation.data!.reason,
        cardId: review.cardId,
      });

      return NextResponse.json({
        message:
          "Review reported successfully. Our team will review it shortly.",
      });
    } catch (error) {
      logger.error("Failed to report review:", error);

      return NextResponse.json(
        {
          error: {
            message: "Failed to report review",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  })
);
