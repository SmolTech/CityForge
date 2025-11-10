import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("Simple test endpoint called");
    return NextResponse.json({ status: "ok", message: "Simple test works" });
  } catch (error) {
    console.error("Simple test error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
