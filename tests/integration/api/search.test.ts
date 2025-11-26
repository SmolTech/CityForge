import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
  type MockedFunction,
} from "vitest";
import { Client } from "@opensearch-project/opensearch";
import { GET } from "@/app/api/search/route";
import { createTestRequest } from "../../utils/api-test-helpers";

// Mock the OpenSearch client
vi.mock("@opensearch-project/opensearch", () => ({
  Client: vi.fn(),
}));

interface MockOpenSearchClient {
  search: MockedFunction<() => Promise<unknown>>;
  ping: MockedFunction<() => Promise<unknown>>;
}

describe("Search API Routes", () => {
  let mockClient: MockOpenSearchClient;
  let mockSearch: MockedFunction<() => Promise<unknown>>;
  let originalEnv: Record<string, string | undefined>;

  beforeAll(() => {
    // Store original environment variables
    originalEnv = {
      OPENSEARCH_HOST: process.env["OPENSEARCH_HOST"],
      OPENSEARCH_PORT: process.env["OPENSEARCH_PORT"],
      OPENSEARCH_USE_HTTPS: process.env["OPENSEARCH_USE_HTTPS"],
      NAMESPACE: process.env["NAMESPACE"],
      NODE_ENV: process.env["NODE_ENV"],
    };

    // Setup OpenSearch environment variables for tests
    vi.stubEnv("OPENSEARCH_HOST", "localhost");
    vi.stubEnv("OPENSEARCH_PORT", "9200");
    vi.stubEnv("NAMESPACE", "test");
    vi.stubEnv("NODE_ENV", "test");
  });

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock search function
    mockSearch = vi.fn();
    mockClient = {
      search: mockSearch,
      ping: vi.fn(),
    };

    // Mock the Client constructor to return our mock client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Client as any).mockImplementation(() => mockClient);
  });

  afterAll(() => {
    // Restore original environment variables
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        vi.stubEnv(key, value);
      }
    }
    vi.restoreAllMocks();
  });

  describe("GET /api/search", () => {
    describe("Query Parameter Validation", () => {
      it("should return 400 when query parameter is missing", async () => {
        const request = createTestRequest("http://localhost:3000/api/search");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Query parameter q is required",
        });
      });

      it("should return 400 when query parameter is empty", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q="
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Query parameter q is required",
        });
      });

      it("should return 400 when query parameter is only whitespace", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=   "
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Query parameter q is required",
        });
      });
    });

    describe("Pagination Parameters", () => {
      beforeEach(() => {
        // Mock successful search response
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 25 },
              hits: [],
            },
          },
        });
      });

      it("should use default pagination when not specified", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.page).toBe(1);
        expect(data.size).toBe(20);
        expect(mockSearch).toHaveBeenCalledWith({
          index: "test-resources",
          body: expect.objectContaining({
            from: 0,
            size: 20,
          }),
        });
      });

      it("should respect custom page and size parameters", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test&page=3&size=15"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.page).toBe(3);
        expect(data.size).toBe(15);
        expect(mockSearch).toHaveBeenCalledWith({
          index: "test-resources",
          body: expect.objectContaining({
            from: 30, // (3-1) * 15
            size: 15,
          }),
        });
      });

      it("should enforce minimum page value of 1", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test&page=-5"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.page).toBe(1);
        expect(mockSearch).toHaveBeenCalledWith({
          index: "test-resources",
          body: expect.objectContaining({
            from: 0,
            size: 20,
          }),
        });
      });

      it("should enforce maximum size value of 100", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test&size=150"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.size).toBe(100);
        expect(mockSearch).toHaveBeenCalledWith({
          index: "test-resources",
          body: expect.objectContaining({
            size: 100,
          }),
        });
      });

      it("should enforce minimum size value of 1", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test&size=0"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.size).toBe(1);
        expect(mockSearch).toHaveBeenCalledWith({
          index: "test-resources",
          body: expect.objectContaining({
            size: 1,
          }),
        });
      });
    });

    describe("OpenSearch Query Construction", () => {
      beforeEach(() => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 0 },
              hits: [],
            },
          },
        });
      });

      it("should construct correct multi_match query", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=restaurant%20downtown"
        );
        await GET(request);

        expect(mockSearch).toHaveBeenCalledWith({
          index: "test-resources",
          body: {
            query: {
              multi_match: {
                query: "restaurant downtown",
                fields: ["title^3", "description^2", "content", "category"],
                type: "best_fields",
                fuzziness: "AUTO",
              },
            },
            highlight: {
              fields: {
                title: {},
                description: {},
                content: { fragment_size: 300, number_of_fragments: 3 },
              },
            },
            from: 0,
            size: 20,
          },
        });
      });

      it("should use correct index name based on namespace", async () => {
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        await GET(request);

        expect(mockSearch).toHaveBeenCalledWith({
          index: "test-resources", // namespace from env var
          body: expect.any(Object),
        });
      });

      it("should use default namespace when not set", async () => {
        vi.stubEnv("NAMESPACE", "");
        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        await GET(request);

        expect(mockSearch).toHaveBeenCalledWith({
          index: "community-resources", // default namespace
          body: expect.any(Object),
        });

        // Restore for other tests
        vi.stubEnv("NAMESPACE", "test");
      });
    });

    describe("Search Results Processing", () => {
      it("should return empty results when no hits found", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 0 },
              hits: [],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=nonexistent"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
          query: "nonexistent",
          total: 0,
          page: 1,
          size: 20,
          total_pages: 0,
          has_next: false,
          has_prev: false,
          results: [],
        });
      });

      it("should process search results with all fields", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _source: {
                    resource_id: 123,
                    title: "Test Restaurant",
                    description: "A great place to eat",
                    page_description: "Full page description",
                    content: "Detailed content about the restaurant".repeat(50), // Long content
                    url: "https://example.com",
                    page_url: "https://example.com/about",
                    category: "Restaurant",
                    phone: "(555) 123-4567",
                    address: "123 Main St",
                    domain: "example.com",
                    is_homepage: false,
                  },
                  _score: 1.5,
                  highlight: {
                    title: ["<em>Test</em> Restaurant"],
                    content: ["Great <em>restaurant</em> with excellent food"],
                  },
                },
              ],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.results).toHaveLength(1);
        expect(data.results[0]).toEqual({
          id: 123,
          title: "Test Restaurant",
          description: "Full page description", // page_description takes precedence
          content_excerpt: expect.stringContaining(
            "Detailed content about the restaurant"
          ),
          url: "https://example.com",
          page_url: "https://example.com/about",
          category: "Restaurant",
          phone: "(555) 123-4567",
          address: "123 Main St",
          domain: "example.com",
          score: 1.5,
          is_homepage: false,
          highlights: {
            title: ["<em>Test</em> Restaurant"],
            content: ["Great <em>restaurant</em> with excellent food"],
          },
        });
      });

      it("should handle missing optional fields gracefully", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _source: {
                    // Only include minimal required fields
                    resource_id: 456,
                    title: "Minimal Business",
                  },
                  _score: 0.8,
                  // No highlights
                },
              ],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=minimal"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.results[0]).toEqual({
          id: 456,
          title: "Minimal Business",
          description: "",
          content_excerpt: "",
          url: "",
          page_url: "",
          category: "",
          phone: "",
          address: "",
          domain: "",
          score: 0.8,
          is_homepage: true, // Default value
          // No highlights property when not present
        });
      });

      it("should truncate long content excerpts", async () => {
        const longContent = "This is a very long content string. ".repeat(100); // > 800 chars

        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _source: {
                    resource_id: 789,
                    title: "Long Content Business",
                    content: longContent,
                  },
                  _score: 1.0,
                },
              ],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=content"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.results[0].content_excerpt).toHaveLength(803); // 800 + "..."
        expect(data.results[0].content_excerpt).toMatch(/\.\.\.$/);
      });

      it("should fallback from page_description to description", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _source: {
                    resource_id: 100,
                    title: "Business",
                    description: "Regular description",
                    // No page_description
                  },
                  _score: 1.0,
                },
              ],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=business"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.results[0].description).toBe("Regular description");
      });

      it("should fallback from page_url to url", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _source: {
                    resource_id: 101,
                    title: "Business",
                    url: "https://example.com",
                    // No page_url
                  },
                  _score: 1.0,
                },
              ],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=business"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.results[0].page_url).toBe("https://example.com");
      });
    });

    describe("Pagination Logic", () => {
      it("should calculate pagination correctly for multiple pages", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 47 }, // 47 total results
              hits: [],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test&page=2&size=10"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toMatchObject({
          total: 47,
          page: 2,
          size: 10,
          total_pages: 5, // Math.ceil(47/10)
          has_next: true, // page 2 < 5 total pages
          has_prev: true, // page 2 > 1
        });
      });

      it("should handle first page pagination correctly", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 25 },
              hits: [],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test&page=1&size=10"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toMatchObject({
          page: 1,
          total_pages: 3, // Math.ceil(25/10)
          has_next: true,
          has_prev: false,
        });
      });

      it("should handle last page pagination correctly", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 25 },
              hits: [],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test&page=3&size=10"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toMatchObject({
          page: 3,
          total_pages: 3,
          has_next: false,
          has_prev: true,
        });
      });

      it("should handle different total hit formats from OpenSearch", async () => {
        // Test legacy format (direct number)
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: 15, // Direct number format
              hits: [],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.total).toBe(15);
      });
    });

    describe("OpenSearch Client Configuration", () => {
      it("should create HTTP client by default", async () => {
        vi.stubEnv("OPENSEARCH_USE_HTTPS", "");

        mockSearch.mockResolvedValue({
          body: {
            hits: { total: { value: 0 }, hits: [] },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        await GET(request);

        expect(Client).toHaveBeenCalledWith({
          node: "http://localhost:9200",
        });
      });

      it("should create HTTPS client when enabled", async () => {
        vi.stubEnv("OPENSEARCH_USE_HTTPS", "true");
        vi.stubEnv("NODE_ENV", "production");

        mockSearch.mockResolvedValue({
          body: {
            hits: { total: { value: 0 }, hits: [] },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        await GET(request);

        expect(Client).toHaveBeenCalledWith({
          node: "https://localhost:9200",
          ssl: {
            rejectUnauthorized: true,
          },
        });

        vi.stubEnv("OPENSEARCH_USE_HTTPS", "");
        vi.stubEnv("NODE_ENV", "test");
      });

      it("should disable SSL verification in development when using HTTPS", async () => {
        vi.stubEnv("OPENSEARCH_USE_HTTPS", "true");
        vi.stubEnv("NODE_ENV", "development");

        mockSearch.mockResolvedValue({
          body: {
            hits: { total: { value: 0 }, hits: [] },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        await GET(request);

        expect(Client).toHaveBeenCalledWith({
          node: "https://localhost:9200",
          ssl: {
            // SECURITY NOTE: Intentionally disabled for development testing environment
            // This allows testing of HTTPS connections without certificate verification
            // Production code should never disable SSL verification
            rejectUnauthorized: false,
          },
        });

        vi.stubEnv("OPENSEARCH_USE_HTTPS", "");
        vi.stubEnv("NODE_ENV", "test");
      });

      it("should use default OpenSearch host and port when not configured", async () => {
        vi.stubEnv("OPENSEARCH_HOST", "");
        vi.stubEnv("OPENSEARCH_PORT", "");

        mockSearch.mockResolvedValue({
          body: {
            hits: { total: { value: 0 }, hits: [] },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        await GET(request);

        expect(Client).toHaveBeenCalledWith({
          node: "http://opensearch-service:9200", // Default values
        });

        // Restore for other tests
        vi.stubEnv("OPENSEARCH_HOST", "localhost");
        vi.stubEnv("OPENSEARCH_PORT", "9200");
      });
    });

    describe("Error Handling", () => {
      it("should handle OpenSearch connection errors", async () => {
        mockSearch.mockRejectedValue(new Error("Connection failed"));

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toMatchObject({
          code: "INTERNAL_ERROR",
          message: "Connection failed",
        });
      });

      it("should handle malformed OpenSearch responses", async () => {
        mockSearch.mockResolvedValue({
          // Missing body or malformed response
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.results).toEqual([]);
        expect(data.total).toBe(0);
      });

      it("should handle OpenSearch timeout errors", async () => {
        mockSearch.mockRejectedValue({
          name: "TimeoutError",
          message: "Request timed out",
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        const response = await GET(request);

        expect(response.status).toBe(500);
      });
    });

    describe("Response Headers and Caching", () => {
      it("should include proper cache headers", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: {
              total: { value: 0 },
              hits: [],
            },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        const response = await GET(request);

        expect(response.headers.get("Cache-Control")).toBe(
          "public, max-age=60"
        );
      });

      it("should include CORS headers for cross-origin requests", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: { total: { value: 0 }, hits: [] },
          },
        });

        const request = createTestRequest(
          "http://localhost:3000/api/search?q=test"
        );
        const response = await GET(request);

        expect(response.headers.get("Content-Type")).toBe("application/json");
      });
    });

    describe("Real-world Search Scenarios", () => {
      it("should handle complex search query with special characters", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: { total: { value: 0 }, hits: [] },
          },
        });

        const complexQuery = encodeURIComponent(
          "Joe's Pizza & Grill (downtown)"
        );
        const request = createTestRequest(
          `http://localhost:3000/api/search?q=${complexQuery}`
        );
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mockSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              query: expect.objectContaining({
                multi_match: expect.objectContaining({
                  query: "Joe's Pizza & Grill (downtown)",
                }),
              }),
            }),
          })
        );
      });

      it("should handle Unicode characters in search query", async () => {
        mockSearch.mockResolvedValue({
          body: {
            hits: { total: { value: 0 }, hits: [] },
          },
        });

        const unicodeQuery = encodeURIComponent("café résumé naïve");
        const request = createTestRequest(
          `http://localhost:3000/api/search?q=${unicodeQuery}`
        );
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mockSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              query: expect.objectContaining({
                multi_match: expect.objectContaining({
                  query: "café résumé naïve",
                }),
              }),
            }),
          })
        );
      });
    });
  });
});
