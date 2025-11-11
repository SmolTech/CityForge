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
    console.log("POSTGRES_USER:", process.env["POSTGRES_USER"]);
    console.log(
      "POSTGRES_PASSWORD:",
      process.env["POSTGRES_PASSWORD"] ? "***SET***" : "***NOT SET***"
    );
    console.log("POSTGRES_HOST:", process.env["POSTGRES_HOST"]);
    console.log("POSTGRES_PORT:", process.env["POSTGRES_PORT"]);
    console.log("POSTGRES_DB:", process.env["POSTGRES_DB"]);
    console.log(
      "All env keys:",
      Object.keys(process.env).filter(
        (k) => k.includes("DATABASE") || k.includes("POSTGRES")
      )
    );

    // Construct DATABASE_URL like the Prisma client does
    const user = process.env["POSTGRES_USER"] || "postgres";
    const host = process.env["POSTGRES_HOST"] || "cityforge-db";
    const port = process.env["POSTGRES_PORT"] || "5432";
    const database = process.env["POSTGRES_DB"] || "cityforge";
    const constructedUrl = `postgresql://${user}:***@${host}:${port}/${database}`;

    console.log("Constructed DATABASE_URL:", constructedUrl);

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
          databaseUrl: constructedUrl,
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
