import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET() {
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
