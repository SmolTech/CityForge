import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/errors";
import { requireAuth } from "@/lib/auth/middleware";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: { message: "Admin access required" } },
      { status: 403 }
    );
  }

  return NextResponse.json({
    webhooksEnabled: process.env["WEBHOOKS_ENABLED"] === "true",
  });
}, "GET /api/admin/config");
