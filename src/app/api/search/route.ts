import { NextRequest, NextResponse } from "next/server";
import { Client } from "@opensearch-project/opensearch";
import { handleApiError, BadRequestError } from "@/lib/errors";

// Rate limiting could be added here similar to other endpoints
// For now, we'll implement the core search functionality

interface SearchResult {
  id: number;
  title: string;
  description: string;
  content_excerpt: string;
  url: string;
  page_url: string;
  category: string;
  phone: string;
  address: string;
  domain: string;
  score: number;
  is_homepage: boolean;
  highlights?: {
    title?: string[];
    description?: string[];
    content?: string[];
  };
}

interface SearchResponse {
  query: string;
  total: number;
  page: number;
  size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  results: SearchResult[];
  error?: string;
}

// Initialize OpenSearch client
function createOpenSearchClient() {
  const opensearchHost = process.env["OPENSEARCH_HOST"] || "opensearch-service";
  const opensearchPort = parseInt(process.env["OPENSEARCH_PORT"] || "9200");
  const useHttps = process.env["OPENSEARCH_USE_HTTPS"] === "true";

  const baseConfig = {
    node: `${useHttps ? "https" : "http"}://${opensearchHost}:${opensearchPort}`,
  };

  // Only add SSL config if using HTTPS
  if (useHttps) {
    return new Client({
      ...baseConfig,
      ssl: {
        rejectUnauthorized: process.env["NODE_ENV"] === "production",
      },
    });
  }

  return new Client(baseConfig);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      throw new BadRequestError("Query parameter q is required");
    }

    const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
    const size = Math.min(
      Math.max(parseInt(searchParams.get("size") || "20"), 1),
      100
    );

    const offset = (page - 1) * size;
    const namespace = process.env["OPENSEARCH_NAMESPACE"] || "community";
    const indexName = `${namespace}-resources`;

    // Create OpenSearch client
    const client = createOpenSearchClient();

    // Build search query body (matching Flask implementation)
    const searchBody = {
      query: {
        multi_match: {
          query: query,
          fields: ["title^3", "description^2", "content", "category"],
          type: "best_fields" as const,
          fuzziness: "AUTO" as const,
        },
      },
      highlight: {
        fields: {
          title: {},
          description: {},
          content: { fragment_size: 300, number_of_fragments: 3 },
        },
      },
      from: offset,
      size: size,
    };

    // Execute search
    const response = await client.search({
      index: indexName,
      body: searchBody,
    });

    // Process results (matching Flask response format)
    const results: SearchResult[] = [];

    if (response.body?.hits?.hits) {
      for (const hit of response.body.hits.hits) {
        const source = hit._source as Record<string, unknown>;

        // Create content excerpt
        let contentExcerpt = "";
        if (source?.["content"] && typeof source["content"] === "string") {
          const contentText = source["content"];
          if (contentText.length > 800) {
            contentExcerpt = contentText.substring(0, 800) + "...";
          } else {
            contentExcerpt = contentText;
          }
        }

        const displayDescription =
          (typeof source?.["page_description"] === "string"
            ? source["page_description"]
            : "") ||
          (typeof source?.["description"] === "string"
            ? source["description"]
            : "") ||
          "";

        const result: SearchResult = {
          id:
            typeof source?.["resource_id"] === "number"
              ? source["resource_id"]
              : 0,
          title: typeof source?.["title"] === "string" ? source["title"] : "",
          description: displayDescription,
          content_excerpt: contentExcerpt,
          url: typeof source?.["url"] === "string" ? source["url"] : "",
          page_url:
            (typeof source?.["page_url"] === "string"
              ? source["page_url"]
              : "") ||
            (typeof source?.["url"] === "string" ? source["url"] : "") ||
            "",
          category:
            typeof source?.["category"] === "string" ? source["category"] : "",
          phone: typeof source?.["phone"] === "string" ? source["phone"] : "",
          address:
            typeof source?.["address"] === "string" ? source["address"] : "",
          domain:
            typeof source?.["domain"] === "string" ? source["domain"] : "",
          score: (hit._score as number) || 0,
          is_homepage: source?.["is_homepage"] !== false, // Default to true
        };

        // Add highlights if available
        if (hit.highlight) {
          result.highlights = hit.highlight as Record<
            string,
            string[] | undefined
          >;
        }

        results.push(result);
      }
    }

    // Calculate pagination info
    const totalHitsObj = response.body?.hits?.total;
    const totalHits =
      typeof totalHitsObj === "number"
        ? totalHitsObj
        : totalHitsObj &&
            typeof totalHitsObj === "object" &&
            "value" in totalHitsObj &&
            typeof totalHitsObj.value === "number"
          ? totalHitsObj.value
          : 0;
    const totalPages = Math.ceil(totalHits / size);

    const searchResponse: SearchResponse = {
      query: query,
      total: totalHits,
      page: page,
      size: size,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      results: results,
    };

    // Set cache headers (similar to other endpoints)
    const responseHeaders = new Headers();
    responseHeaders.set("Cache-Control", "public, max-age=60"); // 1 minute cache

    return NextResponse.json(searchResponse, {
      headers: responseHeaders,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/search");
  }
}
