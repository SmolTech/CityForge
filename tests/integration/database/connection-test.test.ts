import { describe, it, beforeAll } from "vitest";
import { setupIntegrationTests, getTestPrisma } from "../setup";

describe("Database Connection Test", () => {
  beforeAll(async () => {
    await setupIntegrationTests();
  }, 60000);

  it("should verify Prisma connects to Testcontainers", async () => {
    const prisma = getTestPrisma();

    // Get database name
    const result = await prisma.$queryRaw<
      { current_database: string }[]
    >`SELECT current_database()`;
    console.log("Test Prisma database:", result[0].current_database);

    // Import the API client
    const { prisma: apiPrisma } = await import("@/lib/db/client");

    // Get database name from API Prisma
    const apiResult = await apiPrisma.$queryRaw<
      { current_database: string }[]
    >`SELECT current_database()`;
    console.log("API Prisma database:", apiResult[0].current_database);
  });
});
