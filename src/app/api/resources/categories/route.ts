import { NextResponse } from "next/server";
import { resourceQueries } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

/**
 * Get unique categories from resource items
 * Matches Flask API: /api/resources/categories
 */
export async function GET() {
  try {
    const categories = await resourceQueries.getResourceCategoryList();

    const response = NextResponse.json(categories);
    // Cache for 5 minutes (300 seconds) - categories change less frequently
    response.headers.set("Cache-Control", "public, max-age=300");
    return response;
  } catch (error) {
    logger.error("Error getting resource categories:", error);
    return NextResponse.json(
      { error: "Failed to load resource categories" },
      { status: 500 }
    );
  }
}
