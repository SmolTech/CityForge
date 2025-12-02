import { NextResponse } from "next/server";
import { metrics } from "@/lib/monitoring/metrics";

// Force Node.js runtime for metrics collection compatibility
export const runtime = "nodejs";

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

      // For development: Add some sample data if metrics are empty
      // This helps demonstrate the metrics dashboard functionality
      const isDevelopment = process.env.NODE_ENV === "development";
      const hasNoData =
        currentMetrics.httpRequestTotal === 0 &&
        currentMetrics.eventsCount === 0;

      if (isDevelopment && hasNoData) {
        // Generate sample metrics for demonstration
        const sampleMetrics = {
          ...currentMetrics,
          httpRequestTotal: 147,
          httpRequestDuration: [45, 67, 23, 89, 56, 34, 78, 91, 43, 65],
          httpErrorRate: 0.02,
          userRegistrations: 12,
          businessSubmissions: 8,
          searchQueries: 89,
          sitemapGenerations: 3,
          uptime: Date.now() - 3600000, // 1 hour uptime
        };

        return NextResponse.json(
          {
            status: "ok",
            timestamp: new Date().toISOString(),
            metrics: sampleMetrics,
            recentEvents: [
              {
                timestamp: Date.now() - 120000,
                type: "counter",
                name: "httpRequestTotal",
                value: 1,
                labels: { path: "/api/cards", status_code: "200" },
              },
              {
                timestamp: Date.now() - 60000,
                type: "counter",
                name: "searchQueries",
                value: 1,
              },
            ],
            note: "Sample data shown for development. Real metrics collection requires production deployment.",
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          }
        );
      }

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
