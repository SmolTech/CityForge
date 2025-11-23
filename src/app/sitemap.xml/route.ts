import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import {
  businessMetrics,
  createTimingMiddleware,
} from "@/lib/monitoring/metrics";

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: string;
}

function formatDate(date: Date): string {
  const isoString = date.toISOString();
  const datePart = isoString.split("T")[0];
  if (!datePart) {
    throw new Error("Invalid date format");
  }
  return datePart; // YYYY-MM-DD format
}

function createSitemapUrl(
  loc: string,
  lastmod?: Date | null,
  changefreq?: SitemapUrl["changefreq"],
  priority?: string
): SitemapUrl {
  const url: SitemapUrl = { loc };

  if (lastmod) {
    url.lastmod = formatDate(lastmod);
  }

  if (changefreq) {
    url.changefreq = changefreq;
  }

  if (priority) {
    url.priority = priority;
  }

  return url;
}

function generateSitemapXML(urls: SitemapUrl[]): string {
  const urlElements = urls
    .map(
      (url) => `
    <url>
      <loc>${url.loc}</loc>
      ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}
      ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ""}
      ${url.priority ? `<priority>${url.priority}</priority>` : ""}
    </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urlElements}
</urlset>`;
}

async function getStaticUrls(baseUrl: string): Promise<SitemapUrl[]> {
  const today = new Date();

  return [
    // Main pages - highest priority
    createSitemapUrl(baseUrl, today, "daily", "1.0"),
    createSitemapUrl(`${baseUrl}/business`, today, "daily", "0.9"),
    createSitemapUrl(`${baseUrl}/resources`, today, "weekly", "0.8"),
    createSitemapUrl(`${baseUrl}/forums`, today, "daily", "0.8"),
    createSitemapUrl(`${baseUrl}/search`, today, "monthly", "0.7"),
    createSitemapUrl(`${baseUrl}/classifieds`, today, "daily", "0.7"),
    // User action pages - lower priority
    createSitemapUrl(`${baseUrl}/submit`, today, "monthly", "0.5"),
    createSitemapUrl(`${baseUrl}/classifieds/new`, today, "monthly", "0.4"),
    createSitemapUrl(`${baseUrl}/support`, today, "weekly", "0.4"),
    createSitemapUrl(`${baseUrl}/support/new`, today, "monthly", "0.3"),
    // Auth pages - lowest priority
    createSitemapUrl(`${baseUrl}/login`, today, "yearly", "0.2"),
    createSitemapUrl(`${baseUrl}/register`, today, "yearly", "0.2"),
  ];
}

async function getBusinessUrls(baseUrl: string): Promise<SitemapUrl[]> {
  try {
    // Get approved business cards with their basic info
    const cards = await prisma.card.findMany({
      where: {
        approved: true,
      },
      select: {
        id: true,
        name: true,
        updatedDate: true,
      },
      orderBy: {
        updatedDate: "desc",
      },
    });

    return cards.map((card) => {
      // Create SEO-friendly slug from business name
      const slug = card.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Remove duplicate hyphens
        .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

      return createSitemapUrl(
        `${baseUrl}/business/${card.id}/${slug}`,
        card.updatedDate,
        "weekly",
        "0.6"
      );
    });
  } catch (error) {
    logger.error("Error fetching business URLs for sitemap:", error);
    return [];
  }
}

async function getForumUrls(baseUrl: string): Promise<SitemapUrl[]> {
  try {
    const urls: SitemapUrl[] = [];

    // Get active forum categories
    const categories = await prisma.forumCategory.findMany({
      where: {
        isActive: true,
      },
      select: {
        slug: true,
        updatedDate: true,
      },
    });

    // Add category URLs
    categories.forEach((category) => {
      urls.push(
        createSitemapUrl(
          `${baseUrl}/forums/${category.slug}`,
          category.updatedDate,
          "daily",
          "0.7"
        )
      );
    });

    // Get popular/recent forum threads (limit to avoid huge sitemaps)
    const threads = await prisma.forumThread.findMany({
      where: {
        category: {
          isActive: true,
        },
      },
      select: {
        id: true,
        slug: true,
        updatedDate: true,
        category: {
          select: {
            slug: true,
          },
        },
        posts: {
          select: {
            id: true,
          },
          take: 1, // Just count if thread has posts
        },
      },
      orderBy: [
        { isPinned: "desc" }, // Pinned threads first
        { updatedDate: "desc" }, // Then by recency
      ],
      take: 200, // Limit to prevent massive sitemaps
    });

    // Add thread URLs (only threads with posts)
    threads
      .filter((thread) => thread.posts.length > 0)
      .forEach((thread) => {
        urls.push(
          createSitemapUrl(
            `${baseUrl}/forums/${thread.category.slug}/${thread.id}`,
            thread.updatedDate,
            "weekly",
            "0.5"
          )
        );
      });

    return urls;
  } catch (error) {
    logger.error("Error fetching forum URLs for sitemap:", error);
    return [];
  }
}

async function getHelpWantedUrls(baseUrl: string): Promise<SitemapUrl[]> {
  try {
    // Get recent help wanted posts (limit to prevent huge sitemaps)
    const posts = await prisma.helpWantedPost.findMany({
      where: {
        status: "active", // HelpWantedPost uses status field, not isActive
      },
      select: {
        id: true,
        updatedDate: true,
      },
      orderBy: {
        updatedDate: "desc",
      },
      take: 100, // Limit recent posts
    });

    return posts.map((post) =>
      createSitemapUrl(
        `${baseUrl}/help-wanted/${post.id}`,
        post.updatedDate,
        "weekly",
        "0.5"
      )
    );
  } catch (error) {
    logger.error("Error fetching help wanted URLs for sitemap:", error);
    return [];
  }
}

function getBaseUrl(): string {
  // Use dynamic property access to prevent Next.js from inlining env vars at build time
  // This is critical for standalone mode where the same Docker image runs in multiple envs
  const siteUrl = process.env["SITE_URL"];
  const publicSiteUrl = process.env["NEXT_PUBLIC_SITE_URL"];
  return siteUrl || publicSiteUrl || "http://localhost:3000";
}

export async function GET(): Promise<NextResponse> {
  const timing = createTimingMiddleware();
  const startTime = timing.start();

  try {
    // Get base URL from environment variable
    const baseUrl = getBaseUrl();

    // Collect all URLs
    const [staticUrls, businessUrls, forumUrls, helpWantedUrls] =
      await Promise.all([
        getStaticUrls(baseUrl),
        getBusinessUrls(baseUrl),
        getForumUrls(baseUrl),
        getHelpWantedUrls(baseUrl),
      ]);

    const allUrls = [
      ...staticUrls,
      ...businessUrls,
      ...forumUrls,
      ...helpWantedUrls,
    ];

    // Generate XML sitemap
    const sitemapXml = generateSitemapXML(allUrls);

    logger.info(`Generated sitemap with ${allUrls.length} URLs for ${baseUrl}`);

    // Track sitemap generation metrics
    businessMetrics.sitemapGenerated();
    timing.end(startTime, 200, "/sitemap.xml");

    // Return XML response with proper headers
    return new NextResponse(sitemapXml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400", // Cache for 1 hour, revalidate daily
      },
    });
  } catch (error) {
    logger.error("Error generating sitemap:", error);

    // Track error metrics
    timing.end(startTime, 500, "/sitemap.xml");

    // Return a basic sitemap on error using the same base URL logic
    const baseUrl = getBaseUrl();
    const fallbackUrls = await getStaticUrls(baseUrl);
    const fallbackXml = generateSitemapXML(fallbackUrls);

    return new NextResponse(fallbackXml, {
      status: 500,
      headers: {
        "Content-Type": "application/xml",
      },
    });
  }
}
