import { NextResponse } from "next/server";
import { resourceQueries } from "@/lib/db/queries";

/**
 * Get the resources page configuration including title, description, footer, and site info from database
 * Matches Flask API: /api/resources/config
 */
export async function GET() {
  try {
    const config = await resourceQueries.getResourcesConfig();

    const response = NextResponse.json(config);
    // Cache for 5 minutes (300 seconds) - configuration changes less frequently
    response.headers.set("Cache-Control", "public, max-age=300");
    return response;
  } catch (error) {
    console.error("Error getting resources config:", error);
    return NextResponse.json(
      { error: "Failed to load resources configuration" },
      { status: 500 }
    );
  }
}
