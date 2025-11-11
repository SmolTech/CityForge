import { NextRequest, NextResponse } from "next/server";
import { cardQueries } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

// Cache for 5 minutes (300 seconds) to match Flask API
export const revalidate = 300;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const cardId = parseInt(params.id);

    // Validate card ID
    if (isNaN(cardId) || cardId <= 0) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid card ID",
            code: 400,
          },
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const includeShareUrls = url.searchParams.get("share_url") === "true";
    const includeRatings = url.searchParams.get("ratings") !== "false"; // Default to true

    logger.info("Cards API request", {
      cardId,
      includeShareUrls,
      includeRatings,
    });

    // Get the card data
    const cardData = await cardQueries.getCardById(
      cardId,
      includeShareUrls,
      includeRatings
    );

    if (!cardData) {
      return NextResponse.json(
        {
          error: {
            message: "Card not found",
            code: 404,
          },
        },
        { status: 404 }
      );
    }

    // Transform to snake_case format to match Flask API
    const transformedCard: any = {
      id: cardData.id,
      name: cardData.name,
      description: cardData.description,
      website_url: cardData.websiteUrl,
      phone_number: cardData.phoneNumber,
      email: cardData.email,
      address: cardData.address,
      address_override_url: cardData.addressOverrideUrl,
      contact_name: cardData.contactName,
      featured: cardData.featured,
      image_url: cardData.imageUrl,
      approved: cardData.approved,
      created_date:
        cardData.createdDate?.toISOString() ?? new Date().toISOString(),
      updated_date:
        cardData.updatedDate?.toISOString() ?? new Date().toISOString(),
      approved_date: cardData.approvedDate?.toISOString() || null,
      tags: cardData.card_tags.map((ct: any) => ct.tags.name),
    };

    // Add optional fields if requested
    if (includeShareUrls) {
      const cardWithUrls = cardData as any;
      if (cardWithUrls.slug && cardWithUrls.shareUrl) {
        transformedCard.slug = cardWithUrls.slug;
        transformedCard.share_url = cardWithUrls.shareUrl;
      }
    }

    if (cardData.creator) {
      transformedCard.creator = {
        first_name: cardData.creator.firstName,
        last_name: cardData.creator.lastName,
      };
    }

    if (cardData.approver) {
      transformedCard.approver = {
        first_name: cardData.approver.firstName,
        last_name: cardData.approver.lastName,
      };
    }

    if (includeRatings) {
      const cardWithRatings = cardData as any;
      transformedCard.average_rating = cardWithRatings.averageRating;
      transformedCard.review_count = cardWithRatings.reviewCount;

      // Include reviews if present
      if (cardData.reviews && Array.isArray(cardData.reviews)) {
        transformedCard.reviews = cardData.reviews.map((review: any) => ({
          rating: review.rating,
          comment: review.comment,
          created_date: review.createdDate.toISOString(),
          user: review.user
            ? {
                first_name: review.user.firstName,
                last_name: review.user.lastName,
              }
            : null,
        }));
      }
    }

    if (cardData.creator) {
      transformedCard.creator = {
        first_name: cardData.creator.firstName,
        last_name: cardData.creator.lastName,
      };
    }

    if (cardData.approver) {
      transformedCard.approver = {
        first_name: cardData.approver.firstName,
        last_name: cardData.approver.lastName,
      };
    }

    if (includeRatings) {
      transformedCard.average_rating = cardData.averageRating;
      transformedCard.review_count = cardData.reviewCount;

      // Include reviews if present
      if (cardData.reviews && Array.isArray(cardData.reviews)) {
        transformedCard.reviews = cardData.reviews.map((review: any) => ({
          rating: review.rating,
          comment: review.comment,
          created_date: review.createdDate.toISOString(),
          user: review.user
            ? {
                first_name: review.user.firstName,
                last_name: review.user.lastName,
              }
            : null,
        }));
      }
    }

    // Return response matching Flask API format
    const response = NextResponse.json(transformedCard);

    // Set cache headers to match Flask API
    response.headers.set("Cache-Control", "public, max-age=300");

    return response;
  } catch (error) {
    logger.error("Failed to fetch card:", error);

    return NextResponse.json(
      {
        error: {
          message: "Failed to fetch card",
          code: 500,
        },
      },
      { status: 500 }
    );
  }
}
