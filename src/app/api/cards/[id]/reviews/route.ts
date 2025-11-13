import { NextRequest, NextResponse } from "next/server";
import { reviewQueries, cardQueries } from "@/lib/db/queries";
import { validateReview } from "@/lib/validation/reviews";
import { withAuth } from "@/lib/auth/middleware";
import { logger } from "@/lib/logger";
import {
  handleApiError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "@/lib/errors";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/cards/[id]/reviews
 * Get all reviews for a specific card
 * Public endpoint (no authentication required)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const cardId = parseInt(params.id);

    // Validate card ID
    if (isNaN(cardId) || cardId <= 0) {
      throw new BadRequestError("Invalid card ID");
    }

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

    // Check if card exists
    const card = await cardQueries.getCardById(cardId);
    if (!card) {
      throw new NotFoundError("Card");
    }

    // Get reviews with pagination
    const reviewsData = await reviewQueries.getCardReviews(
      cardId,
      limit,
      offset
    );

    // Get rating summary and distribution
    const [ratingSummary, ratingDistribution] = await Promise.all([
      reviewQueries.getCardRatingSummary(cardId),
      reviewQueries.getCardRatingDistribution(cardId),
    ]);

    // Transform reviews to match expected API format
    const transformedReviews = reviewsData.reviews.map((review) => ({
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
    }));

    const responseData = {
      reviews: transformedReviews,
      pagination: {
        limit,
        offset,
        total_count: reviewsData.totalCount,
        has_more: reviewsData.hasMore,
      },
      summary: {
        average_rating: ratingSummary.averageRating,
        total_reviews: ratingSummary.totalReviews,
        rating_distribution: ratingDistribution,
      },
    };

    // Set cache headers (shorter cache for reviews)
    const response = NextResponse.json(responseData);
    response.headers.set("Cache-Control", "public, max-age=60");

    return response;
  } catch (error) {
    return handleApiError(error, "GET /api/cards/[id]/reviews");
  }
}

/**
 * POST /api/cards/[id]/reviews
 * Create a new review for a card
 * Requires authentication
 */
export const POST = withAuth(
  async (request: NextRequest, { user }, context: RouteContext) => {
    try {
      const params = await context.params;
      const cardId = parseInt(params.id);

      // Validate card ID
      if (isNaN(cardId) || cardId <= 0) {
        throw new BadRequestError("Invalid card ID");
      }

      // Check if card exists
      const card = await cardQueries.getCardById(cardId);
      if (!card) {
        throw new NotFoundError("Card");
      }

      // Check if user already has a review for this card
      const existingReview = await reviewQueries.getUserReviewForCard(
        user.id,
        cardId
      );
      if (existingReview) {
        throw new ConflictError(
          "You have already reviewed this business. Use PUT to update your review."
        );
      }

      // Parse and validate request data
      const body = await request.json();
      const validation = validateReview(body);

      if (!validation.isValid || !validation.data) {
        throw new ValidationError("Validation failed", validation.errors);
      }

      // Create the review
      const reviewData: {
        cardId: number;
        userId: number;
        hidden: boolean;
        rating: number;
        title?: string;
        comment?: string;
      } = {
        cardId,
        userId: user.id,
        hidden: false, // Explicitly set to false to ensure visibility
        rating: validation.data.rating,
      };

      // Only add optional fields if they are defined
      if (validation.data.title) reviewData.title = validation.data.title;
      if (validation.data.comment) reviewData.comment = validation.data.comment;

      const review = await reviewQueries.createReview(reviewData);

      // Transform response to match API format
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
        card: {
          name: review.card?.name || card.name,
        },
      };

      logger.info("Review created", {
        reviewId: review.id,
        cardId,
        userId: user.id,
        rating: review.rating,
      });

      return NextResponse.json(responseData, { status: 201 });
    } catch (error) {
      return handleApiError(error, "POST /api/cards/[id]/reviews");
    }
  }
);
