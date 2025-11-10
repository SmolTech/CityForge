import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { resourceQueries } from "@/lib/db/queries";

// This route will be statically generated at build time and revalidated every 5 minutes
export const revalidate = 300;

export async function GET() {
  try {
    logger.info("Site config API request");

    // Get site configuration directly from database using Prisma
    const configData = await resourceQueries.getSiteConfig();

    // Build configuration object with fallback values
    const siteConfig = {
      title: configData["site_title"] || "Community Website",
      description:
        configData["site_description"] ||
        "Helping connect people to the resources available to them.",
      tagline: configData["site_tagline"] || "Community Directory",
      directoryDescription:
        configData["directory_description"] ||
        "Discover local resources and community information.",
      copyright: configData["site_copyright"] || "2025",
      copyrightHolder: configData["site_copyright_holder"] || "Community",
      copyrightUrl: configData["site_copyright_url"] || "#",
      domain: configData["site_domain"] || "community.local",
      shortName: configData["site_short_name"] || "Community",
      fullName: configData["site_full_name"] || "Community Website",
      themeColor: configData["site_theme_color"] || "#000000",
      backgroundColor: configData["site_background_color"] || "#ffffff",
      googleAnalyticsId: configData["google_analytics_id"] || "",
    };

    // Pagination configuration
    const paginationConfig = {
      defaultLimit: parseInt(configData["pagination_default_limit"] || "20"),
    };

    const response = {
      site: siteConfig,
      pagination: paginationConfig,
    };

    logger.info("Site config loaded successfully:", siteConfig.title);

    // Return the site configuration with caching headers
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300", // 5 minutes cache
      },
    });
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
        themeColor: "#000000",
        backgroundColor: "#ffffff",
        googleAnalyticsId: "",
      },
      pagination: {
        defaultLimit: 20,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60", // 1 minute cache for fallback
      },
    }
  );
}
