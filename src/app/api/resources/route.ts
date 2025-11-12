import { NextResponse } from "next/server";
import { resourceQueries } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

/**
 * Get complete resources page data in format expected by frontend
 * Matches Flask API: /api/resources
 */
export async function GET() {
  try {
    // Fetch all data in parallel
    const [config, quickAccess, resourceItems] = await Promise.all([
      resourceQueries.getResourcesConfig(),
      resourceQueries.getQuickAccessItems(),
      resourceQueries.getResourceItems(),
    ]);

    const result = {
      site: config.site,
      title: config.title,
      description: config.description,
      quickAccess,
      resources: resourceItems,
      footer: config.footer,
    };

    const response = NextResponse.json(result);
    // Cache for 5 minutes (300 seconds) - resources change less frequently
    response.headers.set("Cache-Control", "public, max-age=300");
    return response;
  } catch (error) {
    logger.error("Error getting complete resources data:", error);
    return NextResponse.json(
      { error: "Failed to load resources data" },
      { status: 500 }
    );
  }
}
