import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db/client";
import { metrics } from "@/lib/monitoring/metrics";

/**
 * GET /api/health
 * Health check endpoint for Kubernetes liveness and readiness probes
 */
export async function GET() {
  try {
    // Use the shared database client for health check
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
          databaseUrl: "redacted", // Database URL redacted for security
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
