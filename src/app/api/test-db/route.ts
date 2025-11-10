import { NextResponse } from "next/server";
import { cardQueries } from "@/lib/db/queries";

export async function GET() {
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
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
