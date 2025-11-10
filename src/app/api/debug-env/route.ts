import { NextResponse } from "next/server";

/**
 * GET /api/debug-env
 * Debug endpoint to check environment variables in API routes
 */
export async function GET() {
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env["DATABASE_URL"],
    POSTGRES_USER: process.env["POSTGRES_USER"],
    POSTGRES_PASSWORD: process.env["POSTGRES_PASSWORD"]
      ? "***SET***"
      : "***NOT_SET***",
    POSTGRES_HOST: process.env["POSTGRES_HOST"],
    POSTGRES_PORT: process.env["POSTGRES_PORT"],
    POSTGRES_DB: process.env["POSTGRES_DB"],
  };

  return NextResponse.json(
    {
      status: "debug",
      timestamp: new Date().toISOString(),
      environment: envVars,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
