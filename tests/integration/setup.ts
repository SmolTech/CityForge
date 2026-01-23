/**
 * Integration test setup with Testcontainers
 *
 * This file manages the PostgreSQL test container lifecycle:
 * - Starts a PostgreSQL container before all tests
 * - Applies database schema via Prisma
 * - Provides cleanup utilities
 * - Stops the container after all tests
 */

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { beforeAll, afterAll } from "vitest";

let postgresContainer: StartedPostgreSqlContainer;
let prisma: PrismaClient;

/**
 * Start PostgreSQL container and setup database schema
 */
export async function setupIntegrationTests() {
  console.log("🐳 Starting PostgreSQL container...");

  // Start PostgreSQL container
  postgresContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("cityforge_test")
    .withUsername("test")
    .withPassword("test")
    .withExposedPorts(5432)
    .start();

  const connectionString = postgresContainer.getConnectionUri();
  console.log("✅ PostgreSQL container started");
  console.log(
    `📍 Container connection: ${connectionString.replace(/:[^:@]+@/, ":***@")}`
  );

  // Set DATABASE_URL for Prisma
  process.env["DATABASE_URL"] = connectionString;
  console.log(
    `📍 DATABASE_URL set to: ${process.env["DATABASE_URL"]?.replace(/:[^:@]+@/, ":***@")}`
  );

  // Clear any cached Prisma client to force recreation with new URL
  // This is needed because API routes import @/lib/db/client which caches the client
  if (globalThis.__prisma) {
    console.log("🔄 Disconnecting existing Prisma client");
    await globalThis.__prisma.$disconnect();
    delete (globalThis as { __prisma?: unknown }).__prisma;
    console.log("✅ Prisma client cleared");
  } else {
    console.log("ℹ️  No existing Prisma client to clear");
  }

  // Force the API routes to use the test Prisma client
  // This is a workaround for ES module caching issues
  // We dynamically import and replace the prisma export
  const dbClient = await import("@/lib/db/client");
  // Replace the cached prisma client with our test one
  Object.defineProperty(dbClient, "prisma", {
    get() {
      return prisma;
    },
    configurable: true,
  });
  Object.defineProperty(dbClient, "default", {
    get() {
      return prisma;
    },
    configurable: true,
  });
  console.log("✅ Replaced API Prisma client with test client");

  // Run Prisma migrations to create schema
  console.log("📦 Applying database schema...");
  try {
    execSync("npx prisma db push --skip-generate", {
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
      },
      stdio: "inherit",
    });
    console.log("✅ Database schema applied");
  } catch (error) {
    console.error("❌ Failed to apply database schema:", error);
    throw error;
  }

  // Create Prisma client with test database URL
  prisma = new PrismaClient({
    datasourceUrl: connectionString,
  });

  await prisma.$connect();
  console.log("✅ Connected to test database");

  return { prisma, connectionString };
}

/**
 * Clean up after all tests
 */
export async function teardownIntegrationTests() {
  console.log("🧹 Cleaning up integration tests...");

  if (prisma) {
    await prisma.$disconnect();
    console.log("✅ Disconnected from test database");
  }

  if (postgresContainer) {
    await postgresContainer.stop();
    console.log("✅ PostgreSQL container stopped");
  }
}

/**
 * Clean all data from the test database
 */
export async function cleanDatabase() {
  if (!prisma) {
    throw new Error(
      "Prisma client not initialized. Call setupIntegrationTests first."
    );
  }

  console.log("🧹 Cleaning test database...");

  // Clean up in reverse order of dependencies
  await prisma.forumReport.deleteMany({});
  await prisma.forumPost.deleteMany({});
  await prisma.forumThread.deleteMany({});
  await prisma.forumCategory.deleteMany({});
  await prisma.forumCategoryRequest.deleteMany({});
  await prisma.cardModification.deleteMany({});
  await prisma.cardSubmission.deleteMany({});
  await prisma.card_tags.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.resourceItem.deleteMany({});
  await prisma.resourceCategory.deleteMany({});
  await prisma.quickAccessItem.deleteMany({});
  await prisma.resourceConfig.deleteMany({});
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.helpWantedPost.deleteMany({});
  // Clean webhook tables (in dependency order)
  await prisma.webhookDelivery.deleteMany({});
  await prisma.webhookEvent.deleteMany({});
  await prisma.webhookEndpoint.deleteMany({});
  await prisma.user.deleteMany({});

  // Verify cleanup
  const cardCount = await prisma.card.count();
  const userCount = await prisma.user.count();

  console.log(
    `✅ Test database cleaned (cards: ${cardCount}, users: ${userCount})`
  );
}

/**
 * Get the Prisma client for integration tests
 */
export function getTestPrisma() {
  if (!prisma) {
    throw new Error(
      "Prisma client not initialized. Call setupIntegrationTests first."
    );
  }
  return prisma;
}

/**
 * Get the database connection string
 */
export function getConnectionString() {
  if (!postgresContainer) {
    throw new Error(
      "PostgreSQL container not started. Call setupIntegrationTests first."
    );
  }
  return postgresContainer.getConnectionUri();
}

// Global setup/teardown for integration test suites
// These will run once per test file that imports this module
let isSetup = false;

export function setupIntegrationTestSuite() {
  beforeAll(async () => {
    if (!isSetup) {
      await setupIntegrationTests();
      isSetup = true;
    }
  }, 60000); // 60 second timeout for container startup

  afterAll(async () => {
    await teardownIntegrationTests();
  }, 30000); // 30 second timeout for cleanup
}
