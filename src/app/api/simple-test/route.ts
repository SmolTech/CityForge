import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

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
    logger.info("Simple test endpoint called");
    return NextResponse.json({ status: "ok", message: "Simple test works" });
  } catch (error) {
    logger.error("Simple test error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
