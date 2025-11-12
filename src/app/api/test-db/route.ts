import { NextResponse } from "next/server";
import { cardQueries } from "@/lib/db/queries";

export async function GET() {
  // Security check: Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "This test endpoint is not available in production",
      },
      { status: 404 }
    );
  }

  try {
    // Test the cardQueries helper function
    const card = await cardQueries.getCardById(1, false, false);

    return NextResponse.json({
      success: true,
      card: card ? { id: card.id, name: card.name } : null,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        // Remove stack trace in production-like scenarios
        ...(process.env.NODE_ENV === "development" && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500 }
    );
  }
}
