import { PrismaClient } from "@prisma/client";
import { redactDatabaseUrl } from "../utils/log-redaction";
import { logger } from "../logger";

// Global variable to store the Prisma client instance
// This prevents multiple instances during development hot reloading
declare global {
  var __prisma: PrismaClient | undefined;
}

// Build DATABASE_URL from individual components if not provided
function getDatabaseUrl(): string {
  if (process.env["DATABASE_URL"]) {
    logger.debug("[Database] Using DATABASE_URL from environment");
    return process.env["DATABASE_URL"];
  }

  // Build from individual components (for Kubernetes deployments)
  // These come from the Zalando Postgres Operator secret or fallback to defaults
  const user = process.env["POSTGRES_USER"] || "postgres";
  const password = process.env["POSTGRES_PASSWORD"] || "postgres";
  // Host defaults to cluster name from postgres.yaml (metadata.name)
  const host = process.env["POSTGRES_HOST"] || "cityforge-db";
  const port = process.env["POSTGRES_PORT"] || "5432";
  // Database defaults to the database name from postgres.yaml (spec.databases)
  const database = process.env["POSTGRES_DB"] || "cityforge";

  // Construct the URL directly for return, without storing in a variable
  // This prevents the raw URL with credentials from existing in memory/logs
  const constructedUrl = `postgresql://${user}:${password}@${host}:${port}/${database}`;

  // Log only the redacted version for debugging
  logger.debug(
    "[Database] Constructed connection URL:",
    redactDatabaseUrl(constructedUrl)
  );

  return constructedUrl;
}

// Create a singleton Prisma client instance with explicit database URL for Docker compatibility
export const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    errorFormat: "pretty",
  });

// Store the instance globally in development to prevent hot reload issues
if (process.env.NODE_ENV === "development") {
  globalThis.__prisma = prisma;
}

// Graceful shutdown - disconnect when the process terminates
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

export default prisma;

// Helper function to handle database connection errors
export async function connectToDatabase() {
  try {
    await prisma.$connect();
    logger.info("✅ Database connected successfully");
    return true;
  } catch (error) {
    logger.error("❌ Database connection failed:", error);
    return false;
  }
}

// Helper function to check database health
export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "healthy", timestamp: new Date().toISOString() };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}

// Transaction helper with error handling
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(fn);
}
