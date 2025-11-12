import { NextResponse } from "next/server";
import { resourceQueries } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

/**
 * Get quick access items for resources page
 * Matches Flask API: /api/resources/quick-access
 */
export async function GET() {
  try {
    const items = await resourceQueries.getQuickAccessItems();

    const response = NextResponse.json(items);
    // Cache for 5 minutes (300 seconds) - quick access items change less frequently
    response.headers.set("Cache-Control", "public, max-age=300");
    return response;
  } catch (error) {
    logger.error("Error getting quick access items:", error);
    return NextResponse.json(
      { error: "Failed to load quick access items" },
      { status: 500 }
    );
  }
}
