import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { getTestPrisma } from "../integration/setup";

// Lazy Prisma instance - will be initialized on first use
let _testPrisma: PrismaClient | null = null;

// Get the Prisma instance from integration test setup
// This ensures we use the Testcontainers database
function getPrisma(): PrismaClient {
  if (_testPrisma) {
    return _testPrisma;
  }

  try {
    _testPrisma = getTestPrisma();
    return _testPrisma;
  } catch {
    // Fallback for non-integration tests
    _testPrisma = new PrismaClient({
      datasourceUrl:
        process.env["DATABASE_URL"] ||
        "postgresql://test:test@localhost:5432/cityforge_test",
    });
    return _testPrisma;
  }
}

export const testPrisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  },
});

/**
 * Clean up test database by removing test data
 */
export async function cleanupTestDatabase() {
  // Clean up in reverse order of dependencies
  await testPrisma.forumPost.deleteMany({});
  await testPrisma.forumThread.deleteMany({});
  await testPrisma.forumCategory.deleteMany({});
  await testPrisma.cardModification.deleteMany({});
  await testPrisma.cardSubmission.deleteMany({});
  await testPrisma.card_tags.deleteMany({});
  await testPrisma.tag.deleteMany({});
  await testPrisma.card.deleteMany({});
  await testPrisma.resourceItem.deleteMany({});
  await testPrisma.resourceCategory.deleteMany({});
  await testPrisma.quickAccessItem.deleteMany({});
  await testPrisma.resourceConfig.deleteMany({});
  await testPrisma.tokenBlacklist.deleteMany({});
  await testPrisma.user.deleteMany({});
}

/**
 * Create a test user in the database
 */
export async function createTestUserInDb(data: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: "admin" | "supporter" | "user";
  isActive?: boolean;
  emailVerified?: boolean;
}) {
  const passwordHash = await hashPassword(data.password);

  return await testPrisma.user.create({
    data: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      role: data.role || "user",
      isActive: data.isActive ?? true,
      emailVerified: data.emailVerified ?? true,
      createdDate: new Date(),
      lastLogin: new Date(),
    },
  });
}

/**
 * Create a test admin user in the database
 */
export async function createTestAdminInDb(
  overrides: {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  } = {}
) {
  return await createTestUserInDb({
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    password: "AdminPassword123!",
    role: "admin",
    ...overrides,
  });
}

/**
 * Create a test card in the database
 */
export async function createTestCardInDb(data: {
  name: string;
  description?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  websiteUrl?: string;
  tags?: string[];
  userId?: number;
}) {
  // Create the card
  const card = await testPrisma.card.create({
    data: {
      name: data.name,
      description: data.description || `Description for ${data.name}`,
      address: data.address || "123 Test St",
      phoneNumber: data.phoneNumber || "555-0123",
      email: data.email || "contact@example.com",
      websiteUrl: data.websiteUrl || "https://example.com",
      approved: true,
      createdDate: new Date(),
      createdBy: data.userId || 1,
    },
  });

  // Add tags if provided
  if (data.tags && data.tags.length > 0) {
    for (const tagName of data.tags) {
      // Create or find the tag
      let tag = await testPrisma.tag.findUnique({
        where: { name: tagName },
      });

      if (!tag) {
        tag = await testPrisma.tag.create({
          data: { name: tagName },
        });
      }

      // Link card to tag
      await testPrisma.card_tags.create({
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
 * Create a test forum category in the database
 */
export async function createTestForumCategoryInDb(data: {
  name: string;
  description?: string;
  slug?: string;
  displayOrder?: number;
  isActive?: boolean;
  createdBy: number;
}) {
  return await testPrisma.forumCategory.create({
    data: {
      name: data.name,
      description: data.description || `Description for ${data.name}`,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-"),
      displayOrder: data.displayOrder || 1,
      isActive: data.isActive ?? true,
      createdBy: data.createdBy,
      createdDate: new Date(),
    },
  });
}

/**
 * Create a test forum thread in the database
 */
export async function createTestForumThreadInDb(data: {
  title: string;
  slug: string;
  categoryId: number;
  createdBy: number;
  isPinned?: boolean;
  isLocked?: boolean;
}) {
  return await testPrisma.forumThread.create({
    data: {
      title: data.title,
      slug: data.slug,
      categoryId: data.categoryId,
      createdBy: data.createdBy,
      isPinned: data.isPinned || false,
      isLocked: data.isLocked || false,
      reportCount: 0,
      createdDate: new Date(),
      updatedDate: new Date(),
    },
  });
}

/**
 * Setup test database with basic data
 */
export async function setupTestDatabase() {
  // Generate unique suffix to avoid conflicts between parallel tests
  const testId = Date.now() + Math.random();

  // Create test users with unique emails
  const testUser = await createTestUserInDb({
    email: `test-${testId}@example.com`,
    firstName: "Test",
    lastName: "User",
    password: "TestPassword123!",
    role: "user",
  });

  const testAdmin = await createTestAdminInDb({
    email: `admin-${testId}@example.com`,
  });

  // Create test tags with unique names to avoid conflicts
  const tag1 = await testPrisma.tag.create({
    data: { name: `restaurant-${testId}` },
  });

  const tag2 = await testPrisma.tag.create({
    data: { name: `retail-${testId}` },
  });

  return {
    users: { testUser, testAdmin },
    tags: { tag1, tag2 },
  };
}

/**
 * Create a test user with unique email to avoid conflicts
 */
export async function createUniqueTestUser(
  overrides: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: "admin" | "supporter" | "user";
    isActive: boolean;
    emailVerified: boolean;
  }> = {}
) {
  const testId = Date.now() + Math.random();
  return createTestUserInDb({
    email: `user-${testId}@example.com`,
    firstName: "Test",
    lastName: "User",
    password: "TestPassword123!",
    role: "user",
    isActive: true,
    emailVerified: true,
    ...overrides,
  });
}

/**
 * Create a test admin with unique email to avoid conflicts
 */
export async function createUniqueTestAdmin(
  overrides: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }> = {}
) {
  const testId = Date.now() + Math.random();
  return createTestUserInDb({
    email: `admin-${testId}@example.com`,
    firstName: "Admin",
    lastName: "User",
    password: "AdminPassword123!",
    role: "admin",
    isActive: true,
    emailVerified: true,
    ...overrides,
  });
}

/**
 * Convert a database user object to API user format for tests
 */
export function toApiUser(dbUser: {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive?: boolean | null;
  emailVerified?: boolean | null;
}): {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "supporter" | "user";
  isActive?: boolean;
  emailVerified?: boolean;
  isSupporterFlag?: boolean;
} {
  return {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    role: dbUser.role as "admin" | "supporter" | "user",
    ...(dbUser.isActive !== null && { isActive: Boolean(dbUser.isActive) }),
    ...(dbUser.emailVerified !== null && {
      emailVerified: Boolean(dbUser.emailVerified),
    }),
    // Add isSupporterFlag based on role
    ...(dbUser.role === "supporter" && { isSupporterFlag: true }),
  };
}

/**
 * Disconnect from test database
 */
export async function disconnectTestDatabase() {
  await testPrisma.$disconnect();
}
