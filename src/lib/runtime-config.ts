import fs from "fs";
import { logger } from "@/lib/logger";

/**
 * Runtime configuration loader
 *
 * Reads configuration from a JSON file created at container startup.
 * This prevents Next.js from inlining values at build time since the file
 * doesn't exist during the build process.
 */

interface RuntimeConfig {
  siteUrl: string;
}

let cachedConfig: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  // Return cached config if available
  if (cachedConfig) {
    logger.info("[RuntimeConfig] Returning cached config:", cachedConfig);
    return cachedConfig;
  }

  // Try to read runtime config file (created at container startup in /tmp)
  // Using /tmp because it's always writable by the nextjs user
  const configPath = "/tmp/runtime-config.json";

  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, "utf-8");
      logger.info("[RuntimeConfig] Read from file:", configData);
      const parsedConfig = JSON.parse(configData) as RuntimeConfig;
      cachedConfig = parsedConfig;
      logger.info("[RuntimeConfig] Parsed config:", parsedConfig);
      return parsedConfig;
    } else {
      logger.info("[RuntimeConfig] File does not exist:", configPath);
    }
  } catch (error) {
    logger.error("[RuntimeConfig] Failed to read runtime config:", error);
  }

  // Fallback to environment variables (for development)
  const siteUrl =
    process.env["SITE_URL"] ||
    process.env["NEXT_PUBLIC_SITE_URL"] ||
    "http://localhost:3000";

  logger.info(
    "[RuntimeConfig] Using fallback, SITE_URL:",
    process.env["SITE_URL"]
  );
  logger.info("[RuntimeConfig] Using fallback, siteUrl:", siteUrl);

  const fallbackConfig: RuntimeConfig = { siteUrl };
  cachedConfig = fallbackConfig;
  return fallbackConfig;
}

export function getSiteUrl(): string {
  return getRuntimeConfig().siteUrl;
}
