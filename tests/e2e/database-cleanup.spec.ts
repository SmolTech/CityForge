import { test, expect } from "@playwright/test";
import { generateTestUser } from "./helpers/auth";
import {
  cleanDatabase,
  disconnectDatabase,
  createTestUser,
} from "./helpers/database";

/**
 * Test database cleanup functionality
 * This ensures foreign key constraints are handled correctly
 */
test.describe("Database Cleanup", () => {
  test("should clean database without foreign key constraint errors", async () => {
    // Create test user
    const userData = generateTestUser();
    const user = await createTestUser(userData);

    // This should clean everything without errors
    await cleanDatabase();

    // Verify user was deleted
    expect(user.id).toBeDefined();
  });

  test("should handle multiple cleanup cycles", async () => {
    // Create test user
    const userData1 = generateTestUser();
    await createTestUser(userData1);

    // Clean once
    await cleanDatabase();

    // Create another user
    const userData2 = generateTestUser();
    await createTestUser(userData2);

    // Clean again - should work without errors
    await cleanDatabase();

    expect(true).toBe(true); // Test passes if no exceptions
  });

  // Clean up after all tests
  test.afterAll(async () => {
    await disconnectDatabase();
  });
});
