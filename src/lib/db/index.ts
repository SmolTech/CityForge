export { default as prisma } from "./client";
export {
  connectToDatabase,
  checkDatabaseHealth,
  withTransaction,
  withRetry,
  withRetryAndTransaction,
} from "./client";

// Common database operations
export * from "./queries";

// Re-export Prisma types for convenience
export type { Prisma } from "@prisma/client";
