/**
 * Runtime environment variable accessor
 *
 * This prevents Next.js from inlining environment variables at build time
 * in standalone mode. By using dynamic property access, we force the runtime
 * to read from process.env when the function is called.
 */

export function getRuntimeEnv(key: string): string | undefined {
  // Use dynamic property access to prevent build-time inlining
  return process.env[key];
}

export function getSiteUrl(): string {
  // Priority: SITE_URL (runtime) -> NEXT_PUBLIC_SITE_URL (build-time) -> fallback
  return (
    getRuntimeEnv("SITE_URL") ||
    getRuntimeEnv("NEXT_PUBLIC_SITE_URL") ||
    "http://localhost:3000"
  );
}
