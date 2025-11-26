import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { GET as configRoute } from "@/app/api/config/route";
import { assertApiResponse } from "../../utils/api-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
} from "../setup";

describe("Config API Routes", () => {
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

  describe("GET /api/config", () => {
    it("should return site configuration with default values", async () => {
      const response = await configRoute();

      await assertApiResponse(response, 200, (data: any) => {
        expect(data).toHaveProperty("site");
        expect(data).toHaveProperty("pagination");

        // Check site configuration structure
        expect(data.site).toHaveProperty("title");
        expect(data.site).toHaveProperty("description");
        expect(data.site).toHaveProperty("tagline");
        expect(data.site).toHaveProperty("directoryDescription");
        expect(data.site).toHaveProperty("copyright");
        expect(data.site).toHaveProperty("copyrightHolder");
        expect(data.site).toHaveProperty("copyrightUrl");
        expect(data.site).toHaveProperty("domain");
        expect(data.site).toHaveProperty("shortName");
        expect(data.site).toHaveProperty("fullName");
        expect(data.site).toHaveProperty("themeColor");
        expect(data.site).toHaveProperty("backgroundColor");
        expect(data.site).toHaveProperty("googleAnalyticsId");

        // Check pagination configuration
        expect(data.pagination).toHaveProperty("defaultLimit");
        expect(typeof data.pagination.defaultLimit).toBe("number");
        expect(data.pagination.defaultLimit).toBeGreaterThan(0);

        // Check fallback values are used when no custom config exists
        expect(data.site.title).toBe("Community Website");
        expect(data.site.description).toBe(
          "Helping connect people to the resources available to them."
        );
        expect(data.pagination.defaultLimit).toBe(20);
      });

      // Check cache headers (will use fallback max-age=60 if DB unavailable)
      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toMatch(/max-age=\d+/);
      expect(cacheControl).toContain("public");
    });

    it("should return fallback configuration when database is unavailable", async () => {
      // Mock environment to simulate build time (no DATABASE_URL)
      const originalEnv = process.env["DATABASE_URL"];
      // Store original NODE_ENV to restore later

      delete process.env["DATABASE_URL"];
      vi.stubEnv("NODE_ENV", "development");

      try {
        const response = await configRoute();

        await assertApiResponse(response, 200, (data: any) => {
          expect(data).toHaveProperty("site");
          expect(data).toHaveProperty("pagination");

          // Should use fallback values
          expect(data.site.title).toBe("Community Website");
          expect(data.site.description).toBe(
            "Helping connect people to the resources available to them."
          );
          expect(data.pagination.defaultLimit).toBe(20);
        });

        // Check cache headers (shorter cache for fallback)
        expect(response.headers.get("Cache-Control")).toContain("max-age=60");
      } finally {
        // Restore environment
        if (originalEnv) {
          process.env["DATABASE_URL"] = originalEnv;
        }
        vi.unstubAllEnvs();
      }
    });

    it("should have proper JSON structure", async () => {
      const response = await configRoute();

      await assertApiResponse(response, 200, (data: any) => {
        // Verify the exact structure matches what frontend expects
        expect(Object.keys(data)).toEqual(["site", "pagination"]);

        // Site object should have all required fields
        const siteKeys = [
          "title",
          "description",
          "tagline",
          "directoryDescription",
          "copyright",
          "copyrightHolder",
          "copyrightUrl",
          "domain",
          "shortName",
          "fullName",
          "themeColor",
          "backgroundColor",
          "googleAnalyticsId",
        ];
        expect(Object.keys(data.site).sort()).toEqual(siteKeys.sort());

        // Pagination object should have defaultLimit
        expect(Object.keys(data.pagination)).toEqual(["defaultLimit"]);
      });
    });

    it("should handle configuration parsing correctly", async () => {
      const response = await configRoute();

      await assertApiResponse(response, 200, (data: any) => {
        // Pagination defaultLimit should be parsed as integer
        expect(typeof data.pagination.defaultLimit).toBe("number");
        expect(Number.isInteger(data.pagination.defaultLimit)).toBe(true);

        // String fields should not be empty
        expect(data.site.title.length).toBeGreaterThan(0);
        expect(data.site.description.length).toBeGreaterThan(0);
        expect(data.site.copyright.length).toBeGreaterThan(0);
      });
    });

    it("should include proper response headers", async () => {
      const response = await configRoute();

      // Check status
      expect(response.status).toBe(200);

      // Check content type
      expect(response.headers.get("Content-Type")).toContain(
        "application/json"
      );

      // Check cache control header exists
      expect(response.headers.get("Cache-Control")).toBeTruthy();
      expect(response.headers.get("Cache-Control")).toMatch(/max-age=\d+/);
    });
  });
});
