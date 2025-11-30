import { describe, it, expect, afterAll } from "vitest";
import {
  cleanDatabase,
  createTestUser,
  disconnectDatabase,
} from "../../e2e/helpers/database";

/**
 * Test database cleanup functionality
 * This ensures foreign key constraints are handled correctly
 */
describe("Database Cleanup", () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  it("should clean database without foreign key constraint errors", async () => {
    // Create test user
    const userData = {
      email: `test-cleanup-${Date.now()}@test.local`,
      firstName: "Test",
      lastName: "User",
      password: "TestPassword123!",
    };

    const user = await createTestUser(userData);
    expect(user.id).toBeDefined();

    // This should clean everything without errors
    await cleanDatabase();

    // Test passes if no exceptions are thrown
    expect(true).toBe(true);
  });

  it("should handle multiple cleanup cycles", async () => {
    // Create test user
    const userData1 = {
      email: `test-cleanup1-${Date.now()}@test.local`,
      firstName: "Test1",
      lastName: "User1",
      password: "TestPassword123!",
    };
    await createTestUser(userData1);

    // Clean once
    await cleanDatabase();

    // Create another user
    const userData2 = {
      email: `test-cleanup2-${Date.now()}@test.local`,
      firstName: "Test2",
      lastName: "User2",
      password: "TestPassword123!",
    };
    await createTestUser(userData2);

    // Clean again - should work without errors
    await cleanDatabase();

    // Test passes if no exceptions are thrown
    expect(true).toBe(true);
  });

  it("should handle empty database cleanup", async () => {
    // Clean an already clean database - should work without errors
    await cleanDatabase();

    // Test passes if no exceptions are thrown
    expect(true).toBe(true);
  });
});
