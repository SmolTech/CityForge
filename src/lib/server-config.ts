import {
  AppConfig,
  QuickAccessItem,
  ResourceItem,
  FooterConfig,
} from "./resources";
import { logger } from "@/lib/logger";
import { fetchWithTimeout } from "@/lib/utils/fetch-timeout";

export async function loadAppConfig(): Promise<AppConfig> {
  // Default fallback config
  const defaultConfig: AppConfig = {
    site: {
      title: "Community Website",
      description: "Helping connect people to the resources available to them.",
      tagline: "Community Directory",
      directoryDescription:
        "Discover local resources and community information.",
      copyright: "2025",
      copyrightHolder: "Community",
      copyrightUrl: "#",
      domain: "community.local",
      shortName: "Community",
      fullName: "Community Website",
      themeColor: "#1f2937",
      backgroundColor: "#ffffff",
      googleAnalyticsId: "",
    },
    resources: {
      title: "Local Resources",
      description: "Essential links to local services and information",
    },
    quickAccess: [],
    resourceItems: [],
    footer: {
      title: "Get in Touch",
      description:
        "Have questions or want to contribute? We'd love to hear from you.",
      contactEmail: "admin@community.local",
      buttonText: "Contact Us",
    },
    pagination: {
      defaultLimit: 20,
    },
  };

  // During build time, skip fetching and return defaults
  // This prevents database connection errors during Docker builds
  if (
    process.env.NODE_ENV !== "production" &&
    !process.env["SITE_URL"] &&
    !process.env["NEXT_PUBLIC_SITE_URL"]
  ) {
    logger.warn("Build time detected, using default config");
    return defaultConfig;
  }

  try {
    // Fetch from Next.js API route (which in turn fetches from Python backend)
    // Use absolute URL for server-side fetch
    // Priority: SITE_URL (runtime) -> NEXT_PUBLIC_SITE_URL (build-time) -> fallback
    const baseUrl =
      process.env["SITE_URL"] ||
      process.env["NEXT_PUBLIC_SITE_URL"] ||
      "http://localhost:3000";
    const response = await fetchWithTimeout(`${baseUrl}/api/config`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      logger.error("Failed to fetch config from API:", response.status);
      return defaultConfig;
    }

    const backendConfig = await response.json();

    // Merge backend config with defaults
    return {
      site: {
        title: backendConfig.site?.title || defaultConfig.site.title,
        description:
          backendConfig.site?.description || defaultConfig.site.description,
        tagline: backendConfig.site?.tagline || defaultConfig.site.tagline,
        directoryDescription:
          backendConfig.site?.directoryDescription ||
          defaultConfig.site.directoryDescription,
        copyright:
          backendConfig.site?.copyright || defaultConfig.site.copyright,
        copyrightHolder:
          backendConfig.site?.copyrightHolder ||
          defaultConfig.site.copyrightHolder,
        copyrightUrl:
          backendConfig.site?.copyrightUrl || defaultConfig.site.copyrightUrl,
        domain: backendConfig.site?.domain || defaultConfig.site.domain,
        shortName:
          backendConfig.site?.shortName || defaultConfig.site.shortName,
        fullName: backendConfig.site?.fullName || defaultConfig.site.fullName,
        themeColor:
          backendConfig.site?.themeColor || defaultConfig.site.themeColor,
        backgroundColor:
          backendConfig.site?.backgroundColor ||
          defaultConfig.site.backgroundColor,
        googleAnalyticsId:
          backendConfig.site?.googleAnalyticsId ||
          defaultConfig.site.googleAnalyticsId,
      },
      resources: defaultConfig.resources,
      quickAccess: defaultConfig.quickAccess,
      resourceItems: defaultConfig.resourceItems,
      footer: defaultConfig.footer,
      pagination: backendConfig.pagination || defaultConfig.pagination,
    };
  } catch (error) {
    logger.error("Error loading app config:", error);
    return defaultConfig;
  }
}

// Legacy function for backwards compatibility
export async function loadResourcesConfig(): Promise<{
  title: string;
  description: string;
  quickAccess: QuickAccessItem[];
  resources: ResourceItem[];
  footer: FooterConfig;
}> {
  const config = await loadAppConfig();
  return {
    title: config.resources.title,
    description: config.resources.description,
    quickAccess: config.quickAccess,
    resources: config.resourceItems,
    footer: config.footer,
  };
}
