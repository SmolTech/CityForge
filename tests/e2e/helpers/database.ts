import { PrismaClient } from "@prisma/client";

/**
 * E2E Test Database Helpers
 *
 * These helpers interact with the test database to set up and clean up data
 * for E2E tests.
 */

let prisma: PrismaClient | null = null;

/**
 * Get Prisma client instance
 */
function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl:
        process.env["DATABASE_URL"] ||
        "postgresql://postgres:postgres@localhost:5432/cityforge_test",
    });
  }
  return prisma;
}

/**
 * Clean all data from the test database
 * Use this in beforeEach or afterEach to ensure test isolation
 */
export async function cleanDatabase() {
  const db = getPrisma();

  try {
    // Clean up in reverse order of dependencies
    // Use transaction to ensure all deletes succeed or rollback
    await db.$transaction([
      db.forumPost.deleteMany({}),
      db.forumThread.deleteMany({}),
      db.forumCategory.deleteMany({}),
      db.forumCategoryRequest.deleteMany({}),
      db.forumReport.deleteMany({}),
      db.cardModification.deleteMany({}),
      db.cardSubmission.deleteMany({}),
      db.card_tags.deleteMany({}),
      db.review.deleteMany({}),
      db.tag.deleteMany({}),
      db.card.deleteMany({}),
      db.resourceItem.deleteMany({}),
      db.resourceCategory.deleteMany({}),
      db.quickAccessItem.deleteMany({}),
      db.resourceConfig.deleteMany({}),
      db.tokenBlacklist.deleteMany({}),
      db.user.deleteMany({}),
    ]);

    // Small delay to ensure cleanup completes
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    console.error("Database cleanup failed:", error);
    throw error;
  }
}

/**
 * Create a test user in the database
 * Useful for setting up specific test scenarios
 */
export async function createTestUser(userData: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: "admin" | "supporter" | "user";
  isActive?: boolean;
  emailVerified?: boolean;
}) {
  const db = getPrisma();
  const bcrypt = await import("bcrypt");

  // Hash the password first and ensure it completes
  const passwordHash = await bcrypt.hash(userData.password, 10);

  // Create the user
  const user = await db.user.create({
    data: {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      passwordHash,
      role: userData.role || "user",
      isActive: userData.isActive ?? true,
      emailVerified: userData.emailVerified ?? true, // Auto-verify for E2E tests
    },
  });

  // Small delay to ensure user is fully committed to database
  await new Promise((resolve) => setTimeout(resolve, 100));

  return user;
}

/**
 * Create a test business card in the database
 */
export async function createTestCard(cardData: {
  name: string;
  description: string;
  createdBy: number;
  tags?: string[];
  status?: "approved" | "pending" | "rejected";
}) {
  const db = getPrisma();

  const card = await db.card.create({
    data: {
      name: cardData.name,
      description: cardData.description,
      createdBy: cardData.createdBy,
      approved: cardData.status === "approved",
    },
  });

  // Add tags if provided
  if (cardData.tags && cardData.tags.length > 0) {
    for (const tagName of cardData.tags) {
      // Create or find tag
      const tag = await db.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      });

      // Link tag to card
      await db.card_tags.create({
        data: {
          card_id: card.id,
          tag_id: tag.id,
        },
      });
    }
  }

  return card;
}

/**
 * Disconnect Prisma client
 * Call this in afterAll to clean up
 */
export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
