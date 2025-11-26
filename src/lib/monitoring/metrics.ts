/**
 * Application Metrics Collection System
 *
 * Provides lightweight, production-ready metrics collection without external dependencies.
 * Tracks performance, errors, and business metrics for CityForge platform.
 */

interface MetricEvent {
  timestamp: number;
  type: "counter" | "gauge" | "timer" | "custom";
  name: string;
  value: number;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

interface PerformanceMetrics {
  // Request metrics
  httpRequestTotal: number;
  httpRequestDuration: number[];
  httpErrorRate: number;

  // Business metrics
  userRegistrations: number;
  businessSubmissions: number;
  searchQueries: number;
  sitemapGenerations: number;

  // System metrics
  memoryUsage: number;
  responseTime: number;
  databaseConnections: number;
}

class MetricsCollector {
  private metrics: PerformanceMetrics;
  private events: MetricEvent[] = [];
  private maxEvents = 1000; // Keep last 1000 events in memory
  private startTime = Date.now();

  constructor() {
    this.metrics = {
      httpRequestTotal: 0,
      httpRequestDuration: [],
      httpErrorRate: 0,
      userRegistrations: 0,
      businessSubmissions: 0,
      searchQueries: 0,
      sitemapGenerations: 0,
      memoryUsage: 0,
      responseTime: 0,
      databaseConnections: 0,
    };

    // Update system metrics every 30 seconds
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.updateSystemMetrics(), 30000);
    }
  }

  /**
   * Record a counter metric (increments)
   */
  incrementCounter(name: string, value = 1, labels?: Record<string, string>) {
    // Handle specific counter metrics with proper typing
    if (name === "httpRequestTotal") {
      this.metrics.httpRequestTotal += value;
    } else if (name === "userRegistrations") {
      this.metrics.userRegistrations += value;
    } else if (name === "businessSubmissions") {
      this.metrics.businessSubmissions += value;
    } else if (name === "searchQueries") {
      this.metrics.searchQueries += value;
    } else if (name === "sitemapGenerations") {
      this.metrics.sitemapGenerations += value;
    }

    this.addEvent({
      timestamp: Date.now(),
      type: "counter",
      name,
      value,
      ...(labels && { labels }),
    });
  }

  /**
   * Record a gauge metric (absolute value)
   */
  setGauge(name: string, value: number, labels?: Record<string, string>) {
    // Handle specific gauge metrics with proper typing
    if (name === "httpErrorRate") {
      this.metrics.httpErrorRate = value;
    } else if (name === "memoryUsage") {
      this.metrics.memoryUsage = value;
    } else if (name === "responseTime") {
      this.metrics.responseTime = value;
    } else if (name === "databaseConnections") {
      this.metrics.databaseConnections = value;
    }

    this.addEvent({
      timestamp: Date.now(),
      type: "gauge",
      name,
      value,
      ...(labels && { labels }),
    });
  }

  /**
   * Record timing information
   */
  recordTiming(
    name: string,
    duration: number,
    labels?: Record<string, string>
  ) {
    if (name === "httpRequestDuration") {
      this.metrics.httpRequestDuration.push(duration);
      // Keep only last 100 timing measurements
      if (this.metrics.httpRequestDuration.length > 100) {
        this.metrics.httpRequestDuration =
          this.metrics.httpRequestDuration.slice(-100);
      }
    }

    this.addEvent({
      timestamp: Date.now(),
      type: "timer",
      name,
      value: duration,
      ...(labels && { labels }),
    });
  }

  /**
   * Record custom metric
   */
  recordCustom(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ) {
    this.addEvent({
      timestamp: Date.now(),
      type: "custom",
      name,
      value,
      ...(metadata && { metadata }),
    });
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): PerformanceMetrics & { uptime: number; eventsCount: number } {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      eventsCount: this.events.length,
    };
  }

  /**
   * Get recent events (for debugging)
   */
  getRecentEvents(limit = 50): MetricEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    const timestamp = Date.now();
    const uptime = timestamp - this.startTime;

    // HTTP metrics
    lines.push(
      `# HELP cityforge_http_requests_total Total number of HTTP requests`
    );
    lines.push(`# TYPE cityforge_http_requests_total counter`);
    lines.push(
      `cityforge_http_requests_total ${this.metrics.httpRequestTotal} ${timestamp}`
    );

    // Error rate
    lines.push(`# HELP cityforge_http_error_rate HTTP error rate (0-1)`);
    lines.push(`# TYPE cityforge_http_error_rate gauge`);
    lines.push(
      `cityforge_http_error_rate ${this.metrics.httpErrorRate} ${timestamp}`
    );

    // Response time (average of last measurements)
    const avgResponseTime =
      this.metrics.httpRequestDuration.length > 0
        ? this.metrics.httpRequestDuration.reduce((a, b) => a + b, 0) /
          this.metrics.httpRequestDuration.length
        : 0;
    lines.push(
      `# HELP cityforge_http_response_time_ms Average HTTP response time in milliseconds`
    );
    lines.push(`# TYPE cityforge_http_response_time_ms gauge`);
    lines.push(
      `cityforge_http_response_time_ms ${avgResponseTime} ${timestamp}`
    );

    // Business metrics
    lines.push(
      `# HELP cityforge_user_registrations_total Total user registrations`
    );
    lines.push(`# TYPE cityforge_user_registrations_total counter`);
    lines.push(
      `cityforge_user_registrations_total ${this.metrics.userRegistrations} ${timestamp}`
    );

    lines.push(
      `# HELP cityforge_business_submissions_total Total business submissions`
    );
    lines.push(`# TYPE cityforge_business_submissions_total counter`);
    lines.push(
      `cityforge_business_submissions_total ${this.metrics.businessSubmissions} ${timestamp}`
    );

    lines.push(`# HELP cityforge_search_queries_total Total search queries`);
    lines.push(`# TYPE cityforge_search_queries_total counter`);
    lines.push(
      `cityforge_search_queries_total ${this.metrics.searchQueries} ${timestamp}`
    );

    lines.push(
      `# HELP cityforge_sitemap_generations_total Total sitemap generations`
    );
    lines.push(`# TYPE cityforge_sitemap_generations_total counter`);
    lines.push(
      `cityforge_sitemap_generations_total ${this.metrics.sitemapGenerations} ${timestamp}`
    );

    // System metrics
    lines.push(`# HELP cityforge_uptime_seconds Application uptime in seconds`);
    lines.push(`# TYPE cityforge_uptime_seconds gauge`);
    lines.push(`cityforge_uptime_seconds ${uptime / 1000} ${timestamp}`);

    lines.push(`# HELP cityforge_memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE cityforge_memory_usage_bytes gauge`);
    lines.push(
      `cityforge_memory_usage_bytes ${this.metrics.memoryUsage} ${timestamp}`
    );

    return lines.join("\n");
  }

  /**
   * Clear old events to prevent memory buildup
   */
  cleanup() {
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  private addEvent(event: MetricEvent) {
    this.events.push(event);
    this.cleanup();
  }

  private isValidMetricName(name: string): name is keyof PerformanceMetrics {
    return name in this.metrics;
  }

  private updateSystemMetrics() {
    // Update memory usage
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.setGauge("memoryUsage", memUsage.heapUsed);
    }
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

/**
 * Middleware helper for timing HTTP requests
 */
export function createTimingMiddleware() {
  return {
    start: () => Date.now(),
    end: (startTime: number, statusCode: number, path?: string) => {
      const duration = Date.now() - startTime;

      metrics.incrementCounter("httpRequestTotal");
      metrics.recordTiming("httpRequestDuration", duration, {
        status_code: statusCode.toString(),
        path: path || "unknown",
      });

      // Track error rate
      if (statusCode >= 400) {
        const currentMetrics = metrics.getMetrics();
        const currentErrorRate = currentMetrics.httpErrorRate;
        const requestTotal = currentMetrics.httpRequestTotal;
        const newErrorRate =
          (currentErrorRate * (requestTotal - 1) + 1) / requestTotal;
        metrics.setGauge("httpErrorRate", newErrorRate);
      }

      return duration;
    },
  };
}

/**
 * Helper for tracking business events
 */
export const businessMetrics = {
  userRegistered: () => metrics.incrementCounter("userRegistrations"),
  businessSubmitted: () => metrics.incrementCounter("businessSubmissions"),
  searchPerformed: () => metrics.incrementCounter("searchQueries"),
  sitemapGenerated: () => metrics.incrementCounter("sitemapGenerations"),
};
