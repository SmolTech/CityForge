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
    // Helper function to safely delete from a table if it exists
    const safeDelete = async (
      deleteOperation: () => Promise<unknown>,
      tableName: string
    ) => {
      try {
        await deleteOperation();
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2021"
        ) {
          // Table doesn't exist, skip it
          console.log(`Table ${tableName} doesn't exist, skipping cleanup`);
        } else {
          throw error;
        }
      }
    };

    // Clean up in reverse order of dependencies
    // Use individual operations with error handling for missing tables

    // Most dependent tables first
    await safeDelete(
      () => db.passwordResetToken.deleteMany({}),
      "password_reset_tokens"
    );
    await safeDelete(
      () => db.supportTicketMessage.deleteMany({}),
      "support_ticket_messages"
    );
    await safeDelete(() => db.supportTicket.deleteMany({}), "support_tickets");
    await safeDelete(
      () => db.helpWantedReport.deleteMany({}),
      "help_wanted_reports"
    );
    await safeDelete(
      () => db.helpWantedComment.deleteMany({}),
      "help_wanted_comments"
    );
    await safeDelete(
      () => db.helpWantedPost.deleteMany({}),
      "help_wanted_posts"
    );
    await safeDelete(() => db.forumReport.deleteMany({}), "forum_reports");
    await safeDelete(() => db.forumPost.deleteMany({}), "forum_posts");
    await safeDelete(() => db.forumThread.deleteMany({}), "forum_threads");
    await safeDelete(
      () => db.forumCategoryRequest.deleteMany({}),
      "forum_category_requests"
    );
    await safeDelete(() => db.forumCategory.deleteMany({}), "forum_categories");
    await safeDelete(() => db.review.deleteMany({}), "reviews");
    await safeDelete(
      () => db.cardModification.deleteMany({}),
      "card_modifications"
    );
    await safeDelete(
      () => db.cardSubmission.deleteMany({}),
      "card_submissions"
    );
    await safeDelete(() => db.card_tags.deleteMany({}), "card_tags");
    await safeDelete(() => db.card.deleteMany({}), "cards");
    await safeDelete(() => db.tag.deleteMany({}), "tags");
    await safeDelete(() => db.resourceItem.deleteMany({}), "resource_items");
    await safeDelete(
      () => db.resourceCategory.deleteMany({}),
      "resource_categories"
    );
    await safeDelete(
      () => db.quickAccessItem.deleteMany({}),
      "quick_access_items"
    );
    await safeDelete(() => db.resourceConfig.deleteMany({}), "resource_config");
    await safeDelete(() => db.tokenBlacklist.deleteMany({}), "token_blacklist");
    await safeDelete(() => db.indexingJob.deleteMany({}), "indexing_jobs");
    // Users last since many tables reference them
    await safeDelete(() => db.user.deleteMany({}), "users");

    // Small delay to ensure cleanup completes
    await new Promise((resolve) => setTimeout(resolve, 500));
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
  const passwordHash = await bcrypt.hash(userData.password, 12); // Match production API salt rounds

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
 * Get or create a default system user for test data creation
 * This user is used for creating forum categories and other system data
 */
export async function getOrCreateSystemUser() {
  const db = getPrisma();

  const existingUser = await db.user.findFirst({
    where: { email: "system@test.local" },
  });

  if (existingUser) {
    return existingUser;
  }

  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash("SystemUser123!", 12); // Match production API salt rounds

  const systemUser = await db.user.create({
    data: {
      email: "system@test.local",
      firstName: "System",
      lastName: "User",
      passwordHash,
      role: "admin",
      isActive: true,
      emailVerified: true,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  return systemUser;
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
