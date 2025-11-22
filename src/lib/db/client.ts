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
    logger.debug(
      `[Database] Connection URL: ${redactDatabaseUrl(process.env["DATABASE_URL"])}`
    );
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
  // Skip database health check during build time (Docker builds)
  if (
    process.env["SKIP_DATABASE_HEALTH_CHECK"] === "true" ||
    process.env["NEXT_BUILD_TIME"] === "true"
  ) {
    logger.debug("[Database] Skipping health check during build time");
    return {
      status: "unhealthy",
      error: "Build time - database not available",
      timestamp: new Date().toISOString(),
    };
  }

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

// Transaction helper with error handling and timeout options
export async function withTransaction<T>(
  fn: (
    tx: Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
    >
  ) => Promise<T>,
  options?: {
    maxWait?: number; // Max time to wait for transaction to start (ms)
    timeout?: number; // Max time transaction can run (ms)
  }
): Promise<T> {
  try {
    return await prisma.$transaction(fn, options);
  } catch (error) {
    logger.error("Transaction failed:", error);
    throw error;
  }
}

/**
 * Execute a database operation with retry logic and exponential backoff
 * Useful for handling transient database errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    operationName = "Database operation",
  } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      // Check if error is retryable (e.g., connection issues, deadlocks)
      const isRetryable = isRetryableError(error);

      if (isLastAttempt || !isRetryable) {
        logger.error(
          `${operationName} failed after ${attempt} attempts:`,
          error
        );
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = Math.min(
        baseDelay * Math.pow(2, attempt - 1),
        maxDelay
      );
      const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
      const delay = exponentialDelay + jitter;

      logger.warn(
        `${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms:`,
        error
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts`);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Prisma-specific retryable errors
  if (typeof error === "object" && error !== null && "code" in error) {
    const prismaError = error as { code: string };

    // P1001: Can't reach database server
    // P1008: Operations timed out
    // P1017: Server has closed the connection
    // P2034: Transaction failed due to a write conflict or a deadlock
    const retryablePrismaCodes = ["P1001", "P1008", "P1017", "P2034"];

    return retryablePrismaCodes.includes(prismaError.code);
  }

  // Generic connection/timeout errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("connect") ||
      message.includes("timeout") ||
      message.includes("deadlock") ||
      message.includes("connection")
    );
  }

  return false;
}

/**
 * Combined retry + transaction wrapper for critical operations
 */
export async function withRetryAndTransaction<T>(
  callback: (
    tx: Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
    >
  ) => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    transactionTimeout?: number;
    transactionMaxWait?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    transactionTimeout = 10000,
    transactionMaxWait = 5000,
    operationName = "Transaction with retry",
  } = options;

  return withRetry(
    () =>
      withTransaction(callback, {
        timeout: transactionTimeout,
        maxWait: transactionMaxWait,
      }),
    {
      maxRetries,
      baseDelay,
      maxDelay,
      operationName,
    }
  );
}
