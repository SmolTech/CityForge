import {
  AppConfig,
  QuickAccessItem,
  ResourceItem,
  FooterConfig,
} from "./resources";

export function loadAppConfig(): AppConfig {
  return {
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
