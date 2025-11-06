import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// This route will be statically generated at build time and revalidated every 5 minutes
export const revalidate = 300;

export async function GET() {
  try {
    // During build time (when NEXT_PHASE is 'phase-production-build'),
    // return fallback config immediately to prevent dynamic server usage
    if (process.env["NEXT_PHASE"] === "phase-production-build") {
      logger.info("Build phase detected, returning fallback config");
      return getFallbackResponse();
    }

    // Fetch site configuration from backend API
    // Use BACKEND_API_URL for server-side requests to backend container
    // In Kubernetes, this should be set to the internal service (e.g., http://cityforge-backend:5000)
    // Otherwise fall back to NEXT_PUBLIC_API_URL for local dev
    const backendUrl =
      process.env["BACKEND_API_URL"] ||
      process.env["NEXT_PUBLIC_API_URL"] ||
      "http://localhost:5000";

    logger.info(`Fetching site config from: ${backendUrl}/api/site-config`);

    const response = await fetch(`${backendUrl}/api/site-config`);

    if (!response.ok) {
      logger.error(`Backend API returned ${response.status}`);
      throw new Error(`Backend API returned ${response.status}`);
    }

    const config = await response.json();
    logger.info("Site config loaded successfully:", config.site?.title);

    // Return the site configuration with caching headers
    return NextResponse.json(
      {
        site: config.site,
        pagination: config.pagination || { defaultLimit: 20 },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    logger.error("Failed to load site config:", error);

    // Fallback configuration with shorter cache
    return getFallbackResponse();
  }
}

function getFallbackResponse() {
  return NextResponse.json(
    {
      site: {
        title: "Community Website",
        description:
          "Helping connect people to the resources available to them.",
        tagline: "Community Directory",
        directoryDescription:
          "Discover local resources and community information.",
        copyright: "2025",
        copyrightHolder: "Community",
        copyrightUrl: "#",
        domain: "community.local",
        shortName: "Community",
        fullName: "Community Website",
        googleAnalyticsId: "",
      },
      pagination: {
        defaultLimit: 20,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}
