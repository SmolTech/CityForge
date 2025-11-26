import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { GET as healthRoute } from "@/app/api/health/route";
import { assertApiResponse } from "../../utils/api-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
} from "../setup";

interface HealthResponse {
  status: string;
  timestamp: string;
  services: {
    database: string;
    server: string;
  };
  metrics?: {
    uptime: number;
    requestCount: number;
    errorRate: number;
    memoryUsage: number;
    avgResponseTime: number;
  };
  databaseUrl?: string;
  error?: string;
}

describe("Health API Routes", () => {
  beforeAll(async () => {
    await setupIntegrationTests();
  }, 60000);

  afterEach(async () => {
    // Clean database after each test to ensure isolation
    await cleanDatabase();
    // Clear any environment variable mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  }, 30000);

  describe("GET /api/health", () => {
    it("should return healthy status with database connected", async () => {
      const response = await healthRoute();

      await assertApiResponse(response, 200, (data: HealthResponse) => {
        // Basic structure
        expect(data.status).toBe("ok");
        expect(data.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );

        // Services status
        expect(data.services).toBeDefined();
        expect(data.services.database).toBe("connected");
        expect(data.services.server).toBe("running");

        // Metrics
        expect(data.metrics).toBeDefined();
        expect(typeof data.metrics!.uptime).toBe("number");
        expect(data.metrics!.uptime).toBeGreaterThan(0);
        expect(typeof data.metrics!.requestCount).toBe("number");
        expect(data.metrics!.requestCount).toBeGreaterThanOrEqual(0);
        expect(typeof data.metrics!.errorRate).toBe("number");
        expect(data.metrics!.errorRate).toBeGreaterThanOrEqual(0);
        expect(typeof data.metrics!.memoryUsage).toBe("number");
        expect(data.metrics!.memoryUsage).toBeGreaterThanOrEqual(0);
        expect(typeof data.metrics!.avgResponseTime).toBe("number");
        expect(data.metrics!.avgResponseTime).toBeGreaterThanOrEqual(0);

        // Security
        expect(data.databaseUrl).toBe("redacted");
      });

      // Check response headers
      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toBe("no-cache, no-store, must-revalidate");

      const contentType = response.headers.get("Content-Type");
      expect(contentType).toContain("application/json");
    });

    it("should return consistent response format across multiple calls", async () => {
      // Make multiple requests to ensure consistency
      const responses = await Promise.all([
        healthRoute(),
        healthRoute(),
        healthRoute(),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.status).toBe("ok");
        expect(data.services.database).toBe("connected");
        expect(data.services.server).toBe("running");
        expect(data.metrics).toBeDefined();
        expect(data.databaseUrl).toBe("redacted");
      }
    });

    it("should include proper response headers for health checks", async () => {
      const response = await healthRoute();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain(
        "application/json"
      );
      expect(response.headers.get("Cache-Control")).toBe(
        "no-cache, no-store, must-revalidate"
      );
    });

    it("should handle rapid successive health checks without performance issues", async () => {
      const startTime = Date.now();

      // Make 10 rapid requests
      const requests = Array.from({ length: 10 }, () => healthRoute());
      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete within reasonable time (under 2 seconds)
      expect(totalTime).toBeLessThan(2000);

      // All responses should be successful
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it("should track reasonable uptime values", async () => {
      const response1 = await healthRoute();
      const data1 = await response1.json();
      const uptime1 = data1.metrics.uptime;

      // Uptime should be positive and reasonable
      expect(uptime1).toBeGreaterThan(0);
      expect(uptime1).toBeLessThan(3600000); // Less than 1 hour in milliseconds

      // Wait a small amount
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response2 = await healthRoute();
      const data2 = await response2.json();
      const uptime2 = data2.metrics.uptime;

      // Second uptime should be at least the same or greater
      expect(uptime2).toBeGreaterThanOrEqual(uptime1);
    });

    it("should provide meaningful metric values", async () => {
      const response = await healthRoute();
      const data = await response.json();
      const { metrics } = data;

      // Uptime should be reasonable (less than 1 hour for test)
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.uptime).toBeLessThan(3600000); // Less than 1 hour in milliseconds

      // Request count should be non-negative
      expect(metrics.requestCount).toBeGreaterThanOrEqual(0);

      // Error rate should be between 0 and 1
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeLessThanOrEqual(1);

      // Memory usage should be non-negative (may be 0 in test environment)
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);

      // Average response time should be non-negative
      expect(metrics.avgResponseTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle database health check during build time", async () => {
      // Mock build time environment
      const originalSkipCheck = process.env["SKIP_DATABASE_HEALTH_CHECK"];
      const originalBuildTime = process.env["NEXT_BUILD_TIME"];

      try {
        process.env["SKIP_DATABASE_HEALTH_CHECK"] = "true";

        const response = await healthRoute();

        // Should return error status when database health check is skipped
        expect(response.status).toBe(503);

        const data = await response.json();
        expect(data.status).toBe("error");
        expect(data.services.database).toBe("disconnected");
        expect(data.services.server).toBe("running");
        expect(data.error).toContain("Build time");
      } finally {
        // Restore original environment
        if (originalSkipCheck !== undefined) {
          process.env["SKIP_DATABASE_HEALTH_CHECK"] = originalSkipCheck;
        } else {
          delete process.env["SKIP_DATABASE_HEALTH_CHECK"];
        }
        if (originalBuildTime !== undefined) {
          process.env["NEXT_BUILD_TIME"] = originalBuildTime;
        } else {
          delete process.env["NEXT_BUILD_TIME"];
        }
      }
    });

    it("should return proper error response structure when database is unavailable", async () => {
      // Mock environment to skip database health check
      const originalSkipCheck = process.env["SKIP_DATABASE_HEALTH_CHECK"];

      try {
        process.env["SKIP_DATABASE_HEALTH_CHECK"] = "true";

        const response = await healthRoute();

        expect(response.status).toBe(503);

        const data = await response.json();
        expect(data.status).toBe("error");
        expect(data.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
        expect(data.services.database).toBe("disconnected");
        expect(data.services.server).toBe("running");
        expect(typeof data.error).toBe("string");
        expect(data.error.length).toBeGreaterThan(0);

        // Should have proper cache headers even for errors
        const cacheControl = response.headers.get("Cache-Control");
        expect(cacheControl).toBe("no-cache, no-store, must-revalidate");
      } finally {
        // Restore original environment
        if (originalSkipCheck !== undefined) {
          process.env["SKIP_DATABASE_HEALTH_CHECK"] = originalSkipCheck;
        } else {
          delete process.env["SKIP_DATABASE_HEALTH_CHECK"];
        }
      }
    });

    it("should handle concurrent health checks gracefully", async () => {
      // Start 5 concurrent health checks
      const concurrentRequests = Array.from({ length: 5 }, () => healthRoute());

      const responses = await Promise.allSettled(concurrentRequests);

      // All requests should succeed
      responses.forEach((result) => {
        expect(result.status).toBe("fulfilled");
        if (result.status === "fulfilled") {
          expect(result.value.status).toBe(200);
        }
      });
    });
  });
});
