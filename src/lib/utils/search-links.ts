/**
 * Utilities for generating internal links from search results
 */

export interface SearchResultLinkInfo {
  internalUrl: string | null;
  externalUrl: string;
  linkText: string;
  isInternal: boolean;
}

/**
 * Generate a URL slug from a business name
 */
function generateSlug(name: string): string {
  if (!name || typeof name !== "string") {
    return "unnamed-business";
  }

  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "business"
  );
}

/**
 * Determine if a search result should link to internal content
 * and generate appropriate link information
 */
export function getSearchResultLink(result: {
  id: number;
  title: string;
  category: string;
  url: string;
  page_url: string;
  domain: string;
}): SearchResultLinkInfo {
  // Validate input - handle edge cases
  if (!result || typeof result !== "object") {
    return {
      internalUrl: null,
      externalUrl: "#",
      linkText: "Invalid result",
      isInternal: false,
    };
  }

  // Ensure we have required properties with fallbacks
  const safeResult = {
    id: typeof result.id === "number" ? result.id : 0,
    title: typeof result.title === "string" ? result.title : "Untitled",
    category: typeof result.category === "string" ? result.category : "",
    url: typeof result.url === "string" ? result.url : "",
    page_url: typeof result.page_url === "string" ? result.page_url : "",
    domain: typeof result.domain === "string" ? result.domain : "",
  };

  // Check if this is Business Directory content
  if (safeResult.category === "Business Directory" && safeResult.id > 0) {
    const slug = generateSlug(safeResult.title);
    return {
      internalUrl: `/business/${safeResult.id}/${slug}`,
      externalUrl: safeResult.page_url || safeResult.url,
      linkText: safeResult.title,
      isInternal: true,
    };
  }

  // For other categories, check if the domain matches our site
  // This could be expanded to include other internal content types
  const currentDomain =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  const resultDomain = safeResult.domain.toLowerCase();

  // If the result is from our own domain, it might be internal content
  if (
    resultDomain === currentDomain ||
    resultDomain === "community.community"
  ) {
    // Check for specific internal content patterns

    // Resources page
    if (safeResult.page_url.includes("/resources")) {
      return {
        internalUrl: "/resources",
        externalUrl: safeResult.page_url,
        linkText: safeResult.title,
        isInternal: true,
      };
    }

    // Forums (category and thread pages)
    if (safeResult.page_url.includes("/forums/")) {
      const forumMatch = safeResult.page_url.match(
        /\/forums\/([^\/]+)(?:\/(\d+))?/
      );
      if (forumMatch) {
        const categorySlug = forumMatch[1];
        const threadId = forumMatch[2];
        const internalUrl = threadId
          ? `/forums/${categorySlug}/${threadId}`
          : `/forums/${categorySlug}`;

        return {
          internalUrl,
          externalUrl: safeResult.page_url,
          linkText: safeResult.title,
          isInternal: true,
        };
      }
    }

    // Classifieds (listings and individual ads)
    if (safeResult.page_url.includes("/classifieds")) {
      const classifiedMatch = safeResult.page_url.match(
        /\/classifieds(?:\/(\d+))?/
      );
      if (classifiedMatch) {
        const adId = classifiedMatch[1];
        const internalUrl = adId ? `/classifieds/${adId}` : "/classifieds";

        return {
          internalUrl,
          externalUrl: safeResult.page_url,
          linkText: safeResult.title,
          isInternal: true,
        };
      }
    }

    // Support pages (tickets and general support)
    if (safeResult.page_url.includes("/support")) {
      const supportMatch = safeResult.page_url.match(
        /\/support(?:\/(\d+|new))?/
      );
      if (supportMatch) {
        const pageType = supportMatch[1];
        const internalUrl = pageType ? `/support/${pageType}` : "/support";

        return {
          internalUrl,
          externalUrl: safeResult.page_url,
          linkText: safeResult.title,
          isInternal: true,
        };
      }
    }

    // Admin pages (if user has access - could be enhanced with permission checks)
    if (safeResult.page_url.includes("/admin/")) {
      return {
        internalUrl: safeResult.page_url,
        externalUrl: safeResult.page_url,
        linkText: safeResult.title,
        isInternal: true,
      };
    }

    // General internal pages (home, search, submit, etc.)
    const internalPaths = [
      "/",
      "/search",
      "/submit",
      "/dashboard",
      "/settings",
      "/site-config",
    ];

    for (const path of internalPaths) {
      if (safeResult.page_url === path || safeResult.page_url.endsWith(path)) {
        return {
          internalUrl: path,
          externalUrl: safeResult.page_url,
          linkText: safeResult.title,
          isInternal: true,
        };
      }
    }

    // Auth pages (but these are less likely to be indexed)
    const authPaths = [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
    ];
    for (const path of authPaths) {
      if (safeResult.page_url.includes(path)) {
        return {
          internalUrl: path,
          externalUrl: safeResult.page_url,
          linkText: safeResult.title,
          isInternal: true,
        };
      }
    }
  }

  // Default to external link
  return {
    internalUrl: null,
    externalUrl: safeResult.page_url || safeResult.url || "#",
    linkText: safeResult.domain || "Unknown site",
    isInternal: false,
  };
}

/**
 * Get the primary action for a search result (what happens when the card is clicked)
 */
export function getPrimaryAction(result: {
  id: number;
  title: string;
  category: string;
  url: string;
  page_url: string;
  domain: string;
}): { type: "internal" | "external"; url: string } {
  const linkInfo = getSearchResultLink(result);

  if (linkInfo.isInternal && linkInfo.internalUrl) {
    return {
      type: "internal",
      url: linkInfo.internalUrl,
    };
  }

  return {
    type: "external",
    url: linkInfo.externalUrl,
  };
}
