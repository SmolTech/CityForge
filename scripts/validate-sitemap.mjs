#!/usr/bin/env node

/**
 * Sitemap validation script
 * Tests the sitemap generation and validates XML format
 */

import { XMLParser } from "fast-xml-parser";

const SITEMAP_URL =
  process.env.SITEMAP_URL || "http://localhost:3000/sitemap.xml";

async function validateSitemap() {
  console.log(`🔍 Validating sitemap at: ${SITEMAP_URL}`);

  try {
    // Fetch the sitemap
    const response = await fetch(SITEMAP_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/xml")) {
      console.warn(
        `⚠️  Content-Type is '${contentType}', expected 'application/xml'`
      );
    } else {
      console.log("✅ Content-Type is correct");
    }

    // Check cache headers
    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) {
      console.log(`✅ Cache-Control: ${cacheControl}`);
    } else {
      console.warn("⚠️  No Cache-Control header found");
    }

    // Parse XML
    const xmlText = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false });

    try {
      const parsed = parser.parse(xmlText);
      console.log("✅ XML is valid");

      // Validate sitemap structure
      const urlset = parsed?.urlset;
      if (!urlset) {
        throw new Error("No urlset element found");
      }

      const urls = Array.isArray(urlset.url) ? urlset.url : [urlset.url];
      console.log(`✅ Found ${urls.length} URLs in sitemap`);

      // Validate URL structure
      let validUrls = 0;
      const invalidUrls = [];

      for (const url of urls) {
        if (!url.loc) {
          invalidUrls.push("Missing loc element");
          continue;
        }

        // Check if URL is valid
        try {
          new URL(url.loc);
          validUrls++;
        } catch {
          invalidUrls.push(`Invalid URL: ${url.loc}`);
        }
      }

      console.log(`✅ ${validUrls} valid URLs`);

      if (invalidUrls.length > 0) {
        console.error("❌ Invalid URLs found:");
        invalidUrls.forEach((error) => console.error(`  - ${error}`));
      }

      // Show sample URLs
      console.log("\n📋 Sample URLs:");
      urls.slice(0, 5).forEach((url) => {
        console.log(`  - ${url.loc} (priority: ${url.priority || "N/A"})`);
      });

      if (urls.length > 5) {
        console.log(`  ... and ${urls.length - 5} more URLs`);
      }
    } catch (xmlError) {
      console.error("❌ Invalid XML:", xmlError.message);
      console.log("\n📄 Raw XML (first 500 chars):");
      console.log(xmlText.substring(0, 500));
      return false;
    }

    console.log("\n🎉 Sitemap validation completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Sitemap validation failed:", error.message);
    return false;
  }
}

// Run validation
validateSitemap().then((success) => {
  process.exit(success ? 0 : 1);
});
