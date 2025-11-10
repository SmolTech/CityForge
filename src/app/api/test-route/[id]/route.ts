import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return NextResponse.json({
      message: "Test endpoint working",
      id,
      url: request.url,
    });
  } catch {
    return NextResponse.json({ error: "Error occurred" }, { status: 500 });
  }
}
