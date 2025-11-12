import { NextResponse } from "next/server";

/**
 * GET /api/debug-env
 * Debug endpoint to check environment variables in API routes
 * SECURITY: Only accessible in development environment
 */
export async function GET() {
  // Security check: Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "This debug endpoint is not available in production",
      },
      { status: 404 }
    );
  }

  // Build DATABASE_URL for display (masking password)
  const user = process.env["POSTGRES_USER"] || "postgres";
  const host = process.env["POSTGRES_HOST"] || "postgres";
  const port = process.env["POSTGRES_PORT"] || "5432";
  const database = process.env["POSTGRES_DB"] || "community_db";
  const constructedUrl = `postgresql://${user}:***@${host}:${port}/${database}`;

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env["DATABASE_URL"]
      ? process.env["DATABASE_URL"].replace(/:([^:@]+)@/, ":***@")
      : "***NOT_SET***",
    POSTGRES_USER: process.env["POSTGRES_USER"],
    POSTGRES_PASSWORD: process.env["POSTGRES_PASSWORD"]
      ? "***SET***"
      : "***NOT_SET***",
    POSTGRES_HOST: process.env["POSTGRES_HOST"],
    POSTGRES_PORT: process.env["POSTGRES_PORT"],
    POSTGRES_DB: process.env["POSTGRES_DB"],
    CONSTRUCTED_URL: constructedUrl,
  };

  return NextResponse.json(
    {
      status: "debug",
      timestamp: new Date().toISOString(),
      environment: envVars,
      note: "If DATABASE_URL is not set, the app will construct it from POSTGRES_* variables",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
