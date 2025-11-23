import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db/client";
import { redactDatabaseUrl } from "@/lib/utils/log-redaction";
import { metrics } from "@/lib/monitoring/metrics";
import { logger } from "@/lib/logger";

/**
 * GET /api/health
 * Health check endpoint for Kubernetes liveness and readiness probes
 */
export async function GET() {
  try {
    // Debug environment variables with secure logging
    logger.debug("=== HEALTH CHECK DEBUG ===");
    logger.debug("NODE_ENV:", process.env["NODE_ENV"]);
    logger.debug(
      "DATABASE_URL from env:",
      process.env["DATABASE_URL"]
        ? redactDatabaseUrl(process.env["DATABASE_URL"])
        : "NOT SET"
    );
    logger.debug("POSTGRES_USER:", process.env["POSTGRES_USER"]);
    logger.debug(
      "POSTGRES_PASSWORD:",
      process.env["POSTGRES_PASSWORD"] ? "***SET***" : "***NOT SET***"
    );
    logger.debug("POSTGRES_HOST:", process.env["POSTGRES_HOST"]);
    logger.debug("POSTGRES_PORT:", process.env["POSTGRES_PORT"]);
    logger.debug("POSTGRES_DB:", process.env["POSTGRES_DB"]);
    logger.debug(
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
    const constructedUrl = `postgresql://${user}:***REDACTED***@${host}:${port}/${database}`;

    logger.debug("Constructed DATABASE_URL:", constructedUrl);

    // Use the shared database client with explicit URL configuration
    const healthCheck = await checkDatabaseHealth();

    if (healthCheck.status === "healthy") {
      // Get current metrics for health response
      const currentMetrics = metrics.getMetrics();

      return NextResponse.json(
        {
          status: "ok",
          timestamp: new Date().toISOString(),
          services: {
            database: "connected",
            server: "running",
          },
          metrics: {
            uptime: Math.round(currentMetrics.uptime / 1000), // seconds
            requestCount: currentMetrics.httpRequestTotal,
            errorRate: Math.round(currentMetrics.httpErrorRate * 100) / 100, // round to 2 decimals
            memoryUsage: Math.round(currentMetrics.memoryUsage / 1024 / 1024), // MB
            avgResponseTime:
              currentMetrics.httpRequestDuration.length > 0
                ? Math.round(
                    currentMetrics.httpRequestDuration.reduce(
                      (a, b) => a + b,
                      0
                    ) / currentMetrics.httpRequestDuration.length
                  )
                : 0,
          },
          databaseUrl: constructedUrl, // Already redacted
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
    // Safely handle potentially sensitive error data
    const sanitizedDatabaseUrl = process.env["DATABASE_URL"]
      ? redactDatabaseUrl(process.env["DATABASE_URL"]).substring(0, 50) + "..."
      : "not_set";

    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        services: {
          database: "disconnected",
          server: "running",
        },
        databaseUrl: sanitizedDatabaseUrl,
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
