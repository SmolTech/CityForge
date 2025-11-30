import { describe, it, expect, afterAll } from "vitest";
import {
  cleanDatabase,
  createTestUser,
  disconnectDatabase,
} from "../../e2e/helpers/database";
import { createCardSubmission } from "../../e2e/helpers/dashboard";
import { generateTestUser } from "../../e2e/helpers/auth";

/**
 * Integration test for dashboard functionality
 * This tests database operations without requiring the full E2E browser setup
 */
describe("Dashboard Integration", () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  it("should create and clean up test data correctly", async () => {
    // Clean first to ensure clean state
    await cleanDatabase();

    // Create test user
    const userData = generateTestUser();
    const user = await createTestUser(userData);
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);

    // Create card submissions
    const submission1 = await createCardSubmission({
      name: "Test Business 1",
      description: "First test business",
      submittedBy: user.id,
      status: "approved",
    });

    const submission2 = await createCardSubmission({
      name: "Test Business 2",
      description: "Second test business",
      submittedBy: user.id,
      status: "pending",
      reviewNotes: "Needs more information",
    });

    expect(submission1.id).toBeDefined();
    expect(submission1.name).toBe("Test Business 1");
    expect(submission1.status).toBe("approved");

    expect(submission2.id).toBeDefined();
    expect(submission2.name).toBe("Test Business 2");
    expect(submission2.status).toBe("pending");
    expect(submission2.reviewNotes).toBe("Needs more information");

    // Clean up - this tests our enhanced database cleanup
    await cleanDatabase();

    // Test passes if no exceptions are thrown
    expect(true).toBe(true);
  });

  it("should handle multiple users and submissions", async () => {
    // Clean first
    await cleanDatabase();

    // Create multiple users
    const user1Data = generateTestUser();
    const user2Data = generateTestUser();

    const user1 = await createTestUser(user1Data);
    const user2 = await createTestUser(user2Data);

    // Create submissions for both users
    await createCardSubmission({
      name: "User 1 Business",
      description: "Business from user 1",
      submittedBy: user1.id,
      status: "approved",
    });

    await createCardSubmission({
      name: "User 2 Business",
      description: "Business from user 2",
      submittedBy: user2.id,
      status: "rejected",
      reviewNotes: "Invalid submission",
    });

    // Clean up
    await cleanDatabase();

    // Test passes if no foreign key constraint errors occur
    expect(true).toBe(true);
  });

  it("should handle empty database cleanup gracefully", async () => {
    // Clean an already clean database multiple times
    await cleanDatabase();
    await cleanDatabase();
    await cleanDatabase();

    // Should not throw any errors
    expect(true).toBe(true);
  });
});
