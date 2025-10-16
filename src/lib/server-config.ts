import {
  AppConfig,
  QuickAccessItem,
  ResourceItem,
  FooterConfig,
} from "./resources";

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
  };

  try {
    // Fetch from backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const response = await fetch(`${apiUrl}/api/config`, {
      cache: "no-store", // Always get fresh config
    });

    if (!response.ok) {
      console.error("Failed to fetch config from API:", response.status);
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
      },
      resources: defaultConfig.resources,
      quickAccess: defaultConfig.quickAccess,
      resourceItems: defaultConfig.resourceItems,
      footer: defaultConfig.footer,
    };
  } catch (error) {
    console.error("Error loading app config:", error);
    return defaultConfig;
  }
}

// Legacy function for backwards compatibility
export function loadResourcesConfig(): {
  title: string;
  description: string;
  quickAccess: QuickAccessItem[];
  resources: ResourceItem[];
  footer: FooterConfig;
} {
  const config = loadAppConfig();
  return {
    title: config.resources.title,
    description: config.resources.description,
    quickAccess: config.quickAccess,
    resources: config.resourceItems,
    footer: config.footer,
  };
}
