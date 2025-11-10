import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db/client";

/**
 * GET /api/health
 * Health check endpoint for Kubernetes liveness and readiness probes
 */
export async function GET() {
  try {
    // Debug environment variables
    console.log("=== HEALTH CHECK DEBUG ===");
    console.log("NODE_ENV:", process.env["NODE_ENV"]);
    console.log("DATABASE_URL from env:", process.env["DATABASE_URL"]);
    console.log(
      "All env keys:",
      Object.keys(process.env).filter(
        (k) => k.includes("DATABASE") || k.includes("POSTGRES")
      )
    );

    // Get the database URL for display purposes
    const databaseUrl =
      process.env["DATABASE_URL"] ||
      "postgresql://postgres:postgres@postgres:5432/community_db";

    console.log("Final DATABASE_URL:", databaseUrl);

    // Use the shared database client with explicit URL configuration
    const healthCheck = await checkDatabaseHealth();

    if (healthCheck.status === "healthy") {
      return NextResponse.json(
        {
          status: "ok",
          timestamp: new Date().toISOString(),
          services: {
            database: "connected",
            server: "running",
          },
          databaseUrl: databaseUrl.substring(0, 50) + "...",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
    } else {
      throw new Error(healthCheck.error);
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        services: {
          database: "disconnected",
          server: "running",
        },
        databaseUrl:
          (process.env["DATABASE_URL"] || "not_set").substring(0, 50) + "...",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
