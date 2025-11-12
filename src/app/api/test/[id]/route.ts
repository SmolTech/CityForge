import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { id } = await params;
    return NextResponse.json({
      message: "Test endpoint working",
      id: id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Error in test endpoint:",
      error instanceof Error ? error.message : "Unknown error"
    );

    // Only log detailed error information in development
    if (process.env.NODE_ENV === "development") {
      console.error("Test endpoint error details:", error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
