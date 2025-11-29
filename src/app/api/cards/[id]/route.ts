import { NextRequest, NextResponse } from "next/server";
import { cardQueries } from "@/lib/db/queries";
import { logger } from "@/lib/logger";
import { handleApiError, BadRequestError, NotFoundError } from "@/lib/errors";

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
      throw new BadRequestError("Invalid card ID");
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

    // Get the card data (already in snake_case format from getCardById)
    const cardData = await cardQueries.getCardById(
      cardId,
      includeShareUrls,
      includeRatings
    );

    if (!cardData) {
      throw new NotFoundError("Card");
    }

    // Return response matching Flask API format
    const response = NextResponse.json(cardData);

    // Set cache headers to match Flask API
    response.headers.set("Cache-Control", "public, max-age=300");

    return response;
  } catch (error) {
    return handleApiError(error, "GET /api/cards/[id]");
  }
}
