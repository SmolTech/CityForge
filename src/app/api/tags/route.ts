import { NextRequest, NextResponse } from "next/server";
import { tagQueries } from "@/lib/db/queries";
import { logger } from "@/lib/logger";
import { checkDatabaseHealth } from "@/lib/db/client";
import { PAGINATION_LIMITS, paginationUtils } from "@/lib/constants/pagination";
import { handleApiError } from "@/lib/errors";

// Cache for 5 minutes (300 seconds) to match Flask API
export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    logger.info("Tags API request");

    // Parse pagination parameters for security
    const { searchParams } = new URL(request.url);
    const { limit, offset } = paginationUtils.parseFromSearchParams(
      searchParams,
      PAGINATION_LIMITS.TAGS_MAX_LIMIT,
      PAGINATION_LIMITS.TAGS_DEFAULT_LIMIT
    );

    // Check if database is available first (important for Docker builds)
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.status !== "healthy") {
      logger.warn(
        "Database unavailable during tags request, returning empty array:",
        dbHealth.error
      );
      // Return empty tags array during build time
      return NextResponse.json([], {
        headers: {
          "Cache-Control": "public, max-age=60", // Shorter cache for fallback
        },
      });
    }

    // Get all tags with card counts (with pagination)
    const tags = await tagQueries.getAllTags({ limit, offset });

    // Transform data to match Flask API format
    const transformedTags = tags.map((tag: any) => ({
      name: tag.name,
      count: tag._count.cards,
    }));

    logger.info(`Returning ${transformedTags.length} tags`);

    // Return response matching Flask API format
    const response = NextResponse.json(transformedTags);

    // Set cache headers to match Flask API
    response.headers.set("Cache-Control", "public, max-age=300");

    return response;
  } catch (error) {
    return handleApiError(error, "GET /api/tags");
  }
}
