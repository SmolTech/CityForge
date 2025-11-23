import fs from "fs";

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
    return cachedConfig;
  }

  // Try to read runtime config file (created at container startup in /tmp)
  // Using /tmp because it's always writable by the nextjs user
  const configPath = "/tmp/runtime-config.json";

  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, "utf-8");
      const parsedConfig = JSON.parse(configData) as RuntimeConfig;
      cachedConfig = parsedConfig;
      return parsedConfig;
    }
  } catch (error) {
    console.error("Failed to read runtime config:", error);
  }

  // Fallback to environment variables (for development)
  const siteUrl =
    process.env["SITE_URL"] ||
    process.env["NEXT_PUBLIC_SITE_URL"] ||
    "http://localhost:3000";

  const fallbackConfig: RuntimeConfig = { siteUrl };
  cachedConfig = fallbackConfig;
  return fallbackConfig;
}

export function getSiteUrl(): string {
  return getRuntimeConfig().siteUrl;
}
