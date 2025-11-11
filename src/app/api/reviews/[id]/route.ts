import { NextRequest, NextResponse } from "next/server";
import { reviewQueries } from "@/lib/db/queries";
import { validateReviewUpdate } from "@/lib/validation/reviews";
import { withAuth } from "@/lib/auth/middleware";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/reviews/[id]
 * Get a specific review by ID
 * Public endpoint
 */
export async function GET(_request: NextRequest, context: RouteContext) {
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

    // Get review
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

    // Don't show hidden reviews to public
    if (review.hidden) {
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

    // Transform to API format
    const responseData = {
      id: review.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      created_date:
        review.createdDate?.toISOString() ?? new Date().toISOString(),
      updated_date:
        review.updatedDate?.toISOString() ?? new Date().toISOString(),
      user: review.user
        ? {
            first_name: review.user.firstName,
            last_name: review.user.lastName,
          }
        : null,
      card: review.card
        ? {
            name: review.card.name,
          }
        : null,
    };

    // Set cache headers
    const response = NextResponse.json(responseData);
    response.headers.set("Cache-Control", "public, max-age=300");

    return response;
  } catch (error) {
    logger.error("Failed to fetch review:", error);

    return NextResponse.json(
      {
        error: {
          message: "Failed to fetch review",
          code: 500,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reviews/[id]
 * Update a review (user can only update their own reviews)
 * Requires authentication
 */
export const PUT = withAuth(
  async (request: NextRequest, { user }, context: RouteContext) => {
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

      // Check ownership (users can only edit their own reviews)
      if (review.userId !== user.id && user.role !== "admin") {
        return NextResponse.json(
          {
            error: {
              message: "You can only edit your own reviews",
              code: 403,
            },
          },
          { status: 403 }
        );
      }

      // Parse and validate request data
      const body = await request.json();
      const validation = validateReviewUpdate(body);

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

      // Update the review
      const updateData = {
        ...validation.data,
        updatedDate: new Date(),
      };

      const updatedReview = await reviewQueries.updateReview(
        reviewId,
        updateData
      );

      // Transform response to match API format
      const responseData = {
        id: updatedReview.id,
        rating: updatedReview.rating,
        title: updatedReview.title,
        comment: updatedReview.comment,
        created_date:
          updatedReview.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          updatedReview.updatedDate?.toISOString() ?? new Date().toISOString(),
        user: updatedReview.user
          ? {
              first_name: updatedReview.user.firstName,
              last_name: updatedReview.user.lastName,
            }
          : null,
        card: updatedReview.card
          ? {
              name: updatedReview.card.name,
            }
          : null,
      };

      logger.info("Review updated", {
        reviewId,
        userId: user.id,
        rating: updatedReview.rating,
      });

      return NextResponse.json(responseData);
    } catch (error) {
      logger.error("Failed to update review:", error);

      return NextResponse.json(
        {
          error: {
            message: "Failed to update review",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /api/reviews/[id]
 * Delete a review (user can only delete their own reviews)
 * Requires authentication
 */
export const DELETE = withAuth(
  async (_request: NextRequest, { user }, context: RouteContext) => {
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

      // Check ownership (users can only delete their own reviews)
      if (review.userId !== user.id && user.role !== "admin") {
        return NextResponse.json(
          {
            error: {
              message: "You can only delete your own reviews",
              code: 403,
            },
          },
          { status: 403 }
        );
      }

      // Delete the review
      await reviewQueries.deleteReview(reviewId);

      logger.info("Review deleted", {
        reviewId,
        userId: user.id,
        cardId: review.cardId,
      });

      return NextResponse.json({ message: "Review deleted successfully" });
    } catch (error) {
      logger.error("Failed to delete review:", error);

      return NextResponse.json(
        {
          error: {
            message: "Failed to delete review",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  }
);
