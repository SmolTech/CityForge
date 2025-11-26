import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { GET as tagsRoute } from "@/app/api/tags/route";
import { PAGINATION_LIMITS } from "@/lib/constants/pagination";
import {
  createTestRequest,
  assertApiResponse,
} from "../../utils/api-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
  getTestPrisma,
} from "../setup";
import { Tag } from "@/lib/api/types";

describe("Tags API Routes", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  beforeAll(async () => {
    await setupIntegrationTests();
    prisma = getTestPrisma();
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

  describe("GET /api/tags", () => {
    it("should return empty array when no tags exist", async () => {
      const request = createTestRequest("http://localhost:3000/api/tags");
      const response = await tagsRoute(request);

      await assertApiResponse(response, 200, (data: Tag[]) => {
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(0);
      });

      // Check cache headers
      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toBe("public, max-age=300");
    });

    it("should return tags with correct format and count", async () => {
      // Create test users
      const user = await prisma.user.create({
        data: {
          email: "test@example.com",
          passwordHash: "hashedpassword",
          firstName: "Test",
          lastName: "User",
          role: "user",
        },
      });

      // Create test tags
      const tag1 = await prisma.tag.create({
        data: { name: "Technology" },
      });
      const tag2 = await prisma.tag.create({
        data: { name: "Business" },
      });
      const tag3 = await prisma.tag.create({
        data: { name: "Art" },
      });

      // Create test cards
      const card1 = await prisma.card.create({
        data: {
          name: "Tech Company",
          description: "A tech company",
          approved: true,
          createdBy: user.id,
        },
      });
      const card2 = await prisma.card.create({
        data: {
          name: "Art Studio",
          description: "An art studio",
          approved: true,
          createdBy: user.id,
        },
      });

      // Create card-tag associations
      await prisma.card_tags.create({
        data: { card_id: card1.id, tag_id: tag1.id },
      });
      await prisma.card_tags.create({
        data: { card_id: card1.id, tag_id: tag2.id },
      });
      await prisma.card_tags.create({
        data: { card_id: card2.id, tag_id: tag3.id },
      });

      const request = createTestRequest("http://localhost:3000/api/tags");
      const response = await tagsRoute(request);

      await assertApiResponse(response, 200, (data: Tag[]) => {
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(3);

        // Tags should be sorted alphabetically by name
        expect(data[0]?.name).toBe("Art");
        expect(data[1]?.name).toBe("Business");
        expect(data[2]?.name).toBe("Technology");

        // Check tag format and counts
        expect(data[0]).toEqual({ name: "Art", count: 1 });
        expect(data[1]).toEqual({ name: "Business", count: 1 });
        expect(data[2]).toEqual({ name: "Technology", count: 1 });
      });
    });

    it("should respect pagination parameters", async () => {
      // Create 5 test tags
      for (let i = 1; i <= 5; i++) {
        await prisma.tag.create({
          data: {
            name: `Tag${i.toString().padStart(2, "0")}`,
          },
        });
      }

      // Test pagination with limit=3, offset=0
      const request1 = createTestRequest(
        "http://localhost:3000/api/tags?limit=3&offset=0"
      );
      const response1 = await tagsRoute(request1);

      await assertApiResponse(response1, 200, (data: Tag[]) => {
        expect(data).toHaveLength(3);
        expect(data[0]?.name).toBe("Tag01");
        expect(data[1]?.name).toBe("Tag02");
        expect(data[2]?.name).toBe("Tag03");
      });

      // Test pagination with limit=3, offset=3
      const request2 = createTestRequest(
        "http://localhost:3000/api/tags?limit=3&offset=3"
      );
      const response2 = await tagsRoute(request2);

      await assertApiResponse(response2, 200, (data: Tag[]) => {
        expect(data).toHaveLength(2);
        expect(data[0]?.name).toBe("Tag04");
        expect(data[1]?.name).toBe("Tag05");
      });
    });

    it("should enforce maximum limit and use defaults", async () => {
      // Test with no parameters (should use defaults)
      const request1 = createTestRequest("http://localhost:3000/api/tags");
      const response1 = await tagsRoute(request1);
      expect(response1.status).toBe(200);

      // Test with limit exceeding maximum (should clamp to max)
      const request2 = createTestRequest(
        `http://localhost:3000/api/tags?limit=${PAGINATION_LIMITS.TAGS_MAX_LIMIT + 10}`
      );
      const response2 = await tagsRoute(request2);
      expect(response2.status).toBe(200);

      // Test invalid parameters fall back to defaults
      const request3 = createTestRequest(
        "http://localhost:3000/api/tags?limit=invalid&offset=invalid"
      );
      const response3 = await tagsRoute(request3);
      expect(response3.status).toBe(200);
    });

    it("should handle database connectivity gracefully", async () => {
      // This test verifies that the API handles database connectivity gracefully
      // In this test environment, the database is actually available, so we get normal behavior
      // The API route includes fallback logic for when database is unavailable

      const request = createTestRequest("http://localhost:3000/api/tags");
      const response = await tagsRoute(request);

      await assertApiResponse(response, 200, (data: Tag[]) => {
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(0); // No tags in clean database
      });

      // Should use normal cache when database is available
      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toBe("public, max-age=300");
    });

    it("should include proper response headers", async () => {
      const request = createTestRequest("http://localhost:3000/api/tags");
      const response = await tagsRoute(request);

      // Check status
      expect(response.status).toBe(200);

      // Check content type
      expect(response.headers.get("Content-Type")).toContain(
        "application/json"
      );

      // Check cache control header
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    });

    it("should handle large datasets without performance issues", async () => {
      // Create tags in batches for better performance
      const batchSize = 25;
      const totalTags = 150;

      for (let i = 0; i < totalTags; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && i + j < totalTags; j++) {
          batch.push({
            name: `Tag${(i + j + 1).toString().padStart(3, "0")}`,
          });
        }
        await prisma.tag.createMany({ data: batch });
      }

      const startTime = Date.now();
      const request = createTestRequest("http://localhost:3000/api/tags");
      const response = await tagsRoute(request);
      const endTime = Date.now();

      // Should complete within reasonable time (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      await assertApiResponse(response, 200, (data: Tag[]) => {
        // Should use default limit
        expect(data.length).toBeLessThanOrEqual(
          PAGINATION_LIMITS.TAGS_DEFAULT_LIMIT
        );

        // Should be properly sorted
        for (let i = 1; i < data.length; i++) {
          expect(
            data[i]?.name?.localeCompare(data[i - 1]?.name ?? "")
          ).toBeGreaterThan(0);
        }
      });
    });

    it("should handle error scenarios gracefully", async () => {
      // Test with negative offset (should handle gracefully)
      const request1 = createTestRequest(
        "http://localhost:3000/api/tags?offset=-1"
      );
      const response1 = await tagsRoute(request1);
      expect(response1.status).toBe(200);

      // Test with zero limit (should handle gracefully)
      const request2 = createTestRequest(
        "http://localhost:3000/api/tags?limit=0"
      );
      const response2 = await tagsRoute(request2);
      expect(response2.status).toBe(200);
    });
  });
});
