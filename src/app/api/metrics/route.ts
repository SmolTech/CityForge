import { NextResponse } from "next/server";
import { metrics } from "@/lib/monitoring/metrics";

/**
 * GET /api/metrics
 * Production monitoring endpoint for CityForge application metrics
 *
 * Returns metrics in both JSON and Prometheus formats based on Accept header
 */
export async function GET(request: Request) {
  try {
    const acceptHeader = request.headers.get("accept");
    const isPrometheus =
      acceptHeader?.includes("text/plain") ||
      acceptHeader?.includes("application/prometheus") ||
      request.url.includes("format=prometheus");

    if (isPrometheus) {
      // Return Prometheus format for monitoring systems
      const prometheusMetrics = metrics.getPrometheusMetrics();

      return new NextResponse(prometheusMetrics, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    } else {
      // Return JSON format for dashboards and debugging
      const currentMetrics = metrics.getMetrics();
      const recentEvents = metrics.getRecentEvents(10);

      return NextResponse.json(
        {
          status: "ok",
          timestamp: new Date().toISOString(),
          metrics: currentMetrics,
          recentEvents,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
