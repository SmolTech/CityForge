import { NextRequest, NextResponse } from "next/server";
import { resourceQueries } from "@/lib/db/queries";

/**
 * Get resource items, optionally filtered by category
 * Matches Flask API: /api/resources/items
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

    const items = await resourceQueries.getResourceItems(category);

    const response = NextResponse.json(items);
    // Cache for 5 minutes (300 seconds) - resource items change less frequently
    response.headers.set("Cache-Control", "public, max-age=300");
    return response;
  } catch (error) {
    console.error("Error getting resource items:", error);
    return NextResponse.json(
      { error: "Failed to load resource items" },
      { status: 500 }
    );
  }
}
