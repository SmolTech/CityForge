import { NextResponse } from "next/server";
import { tagQueries } from "@/lib/db/queries";
import { logger } from "@/lib/logger";
import { checkDatabaseHealth } from "@/lib/db/client";

// Cache for 5 minutes (300 seconds) to match Flask API
export const revalidate = 300;

export async function GET() {
  try {
    logger.info("Tags API request");

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

    // Get all tags with card counts
    const tags = await tagQueries.getAllTags();

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
    logger.error("Failed to fetch tags:", error);

    return NextResponse.json(
      {
        error: {
          message: "Failed to fetch tags",
          code: 500,
        },
      },
      { status: 500 }
    );
  }
}
