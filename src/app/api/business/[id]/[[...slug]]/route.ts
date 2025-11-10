import { NextRequest, NextResponse } from "next/server";
import { cardQueries } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

// Cache for 5 minutes (300 seconds) to match Flask API
export const revalidate = 300;

interface RouteContext {
  params: Promise<{
    id: string;
    slug?: string[];
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const businessId = parseInt(params.id);
    const slug = params.slug?.[0]; // Get first slug segment if present

    // Validate business ID
    if (isNaN(businessId) || businessId <= 0) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid business ID",
            code: 400,
          },
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const includeRatings = url.searchParams.get("ratings") !== "false"; // Default to true for business route

    logger.info("Business API request", {
      businessId,
      slug,
      includeRatings,
    });

    // Get the business card with shareUrl always enabled for business route
    const card = await cardQueries.getCardById(
      businessId,
      true, // Always include share URLs for business route
      includeRatings
    );

    if (!card) {
      return NextResponse.json(
        {
          error: {
            message: "Business not found",
            code: 404,
          },
        },
        { status: 404 }
      );
    }

    // Check if slug matches (redirect if not)
    if (slug && card.slug && slug !== card.slug) {
      return NextResponse.json(
        { redirect: `/api/business/${businessId}/${card.slug}` },
        { status: 301 }
      );
    }

    // Return response matching Flask API format
    const response = NextResponse.json(card);

    // Set cache headers to match Flask API
    response.headers.set("Cache-Control", "public, max-age=300");

    return response;
  } catch (error) {
    logger.error("Failed to fetch business:", error);

    return NextResponse.json(
      {
        error: {
          message: "Failed to fetch business",
          code: 500,
        },
      },
      { status: 500 }
    );
  }
}
