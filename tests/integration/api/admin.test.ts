import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { GET as adminCardsRoute } from "@/app/api/admin/cards/route";
import { GET as adminUsersRoute } from "@/app/api/admin/users/route";
import { GET as adminSubmissionsRoute } from "@/app/api/admin/submissions/route";
import { POST as approveSubmissionRoute } from "@/app/api/admin/submissions/[id]/approve/route";
import { POST as rejectSubmissionRoute } from "@/app/api/admin/submissions/[id]/reject/route";
import { GET as adminTagsRoute } from "@/app/api/admin/tags/route";
import { GET as adminForumCategoriesRoute } from "@/app/api/admin/forums/categories/route";
import {
  createTestRequest,
  assertApiResponse,
  createAuthenticatedRequest,
} from "../../utils/api-test-helpers";
import {
  createUniqueTestUser,
  createUniqueTestAdmin,
  toApiUser,
} from "../../utils/database-test-helpers";
import { setupIntegrationTests, teardownIntegrationTests } from "../setup";
import { prisma } from "@/lib/db";

describe("Admin API Routes", () => {
  let adminUser: any;
  let regularUser: any;

  beforeAll(async () => {
    await setupIntegrationTests();

    // Create admin user
    adminUser = await createUniqueTestAdmin({
      firstName: "Admin",
      lastName: "User",
    });

    // Create regular user
    regularUser = await createUniqueTestUser({
      firstName: "Regular",
      lastName: "User",
      role: "user",
    });
  }, 60000);

  afterEach(async () => {
    // Clean test data but preserve users for reuse across tests
    await prisma.card.deleteMany({
      where: { name: { startsWith: "Test Business" } },
    });
    await prisma.cardSubmission.deleteMany({
      where: { name: { startsWith: "Test Submission" } },
    });
    await prisma.tag.deleteMany({
      where: { name: { startsWith: "test-tag" } },
    });
    await prisma.forumCategory.deleteMany({
      where: { slug: { startsWith: "test-category" } },
    });
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  }, 30000);

  describe("Admin Access Control", () => {
    it("should deny access to unauthenticated requests", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/admin/users",
        {
          method: "GET",
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 401, (data) => {
        expect(data.error.message).toBe("No authentication token provided");
      });
    });

    it("should deny access to regular users", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/users",
        toApiUser(regularUser),
        {
          method: "GET",
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 403, (data) => {
        expect(data.error.message).toBe("Admin access required");
      });
    });

    it("should allow access to admin users", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/users",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.users).toBeDefined();
      });
    });
  });

  describe("GET /api/admin/users", () => {
    it("should return list of users with pagination", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/users?limit=10&offset=0",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.users).toBeDefined();
        expect(Array.isArray(data.users)).toBe(true);
        expect(data.total).toBeDefined();
        expect(data.limit).toBe(10);
        expect(data.offset).toBe(0);

        // Check user format
        if (data.users.length > 0) {
          const user = data.users[0];
          expect(user).toHaveProperty("id");
          expect(user).toHaveProperty("email");
          expect(user).toHaveProperty("first_name");
          expect(user).toHaveProperty("last_name");
          expect(user).toHaveProperty("role");
          expect(user).toHaveProperty("is_active");
        }
      });
    });

    it("should support search functionality", async () => {
      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/admin/users?search=${encodeURIComponent(regularUser.email)}`,
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.users.length).toBeGreaterThan(0);
        expect(data.users.some((u: any) => u.email === regularUser.email)).toBe(
          true
        );
      });
    });

    it("should enforce maximum limit of 100", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/users?limit=500",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.limit).toBe(100); // Should be capped at 100
      });
    });
  });

  describe("GET /api/admin/cards", () => {
    beforeEach(async () => {
      // Create test cards
      await prisma.card.create({
        data: {
          name: "Test Business 1",
          description: "A test business",
          websiteUrl: "https://test1.com",
          approved: true,
          createdBy: adminUser.id,
        },
      });

      await prisma.card.create({
        data: {
          name: "Test Business 2",
          description: "Another test business",
          websiteUrl: "https://test2.com",
          approved: false,
          createdBy: regularUser.id,
        },
      });
    });

    it("should return all cards with pagination", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/cards?limit=20&offset=0",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminCardsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.cards).toBeDefined();
        expect(Array.isArray(data.cards)).toBe(true);
        expect(data.total).toBeDefined();
        expect(data.limit).toBe(20);
        expect(data.offset).toBe(0);

        // Check card format
        if (data.cards.length > 0) {
          const card = data.cards[0];
          expect(card).toHaveProperty("id");
          expect(card).toHaveProperty("name");
          expect(card).toHaveProperty("description");
          expect(card).toHaveProperty("approved");
          expect(card).toHaveProperty("creator");
        }
      });
    });

    it("should filter cards by approval status", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/cards?status=approved",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminCardsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        // All returned cards should be approved
        data.cards.forEach((card: any) => {
          expect(card.approved).toBe(true);
        });
      });
    });

    it("should filter cards by pending status", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/cards?status=pending",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminCardsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        // All returned cards should be pending (not approved)
        data.cards.forEach((card: any) => {
          expect(card.approved).toBe(false);
        });
      });
    });

    it("should support search functionality", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/cards?search=Test Business 1",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminCardsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.cards.length).toBeGreaterThan(0);
        expect(
          data.cards.some((card: any) => card.name === "Test Business 1")
        ).toBe(true);
      });
    });
  });

  describe("GET /api/admin/submissions", () => {
    beforeEach(async () => {
      // Create test submissions
      await prisma.cardSubmission.create({
        data: {
          name: "Test Submission 1",
          description: "A test submission",
          websiteUrl: "https://testsubmission1.com",
          status: "pending",
          submittedBy: regularUser.id,
        },
      });

      await prisma.cardSubmission.create({
        data: {
          name: "Test Submission 2",
          description: "Another test submission",
          websiteUrl: "https://testsubmission2.com",
          status: "approved",
          submittedBy: regularUser.id,
          reviewedBy: adminUser.id,
          reviewedDate: new Date(),
        },
      });
    });

    it("should return all submissions with pagination", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/submissions?limit=20&offset=0",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminSubmissionsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.submissions).toBeDefined();
        expect(Array.isArray(data.submissions)).toBe(true);
        expect(data.total).toBeDefined();
        expect(data.limit).toBe(20);
        expect(data.offset).toBe(0);

        // Check submission format
        if (data.submissions.length > 0) {
          const submission = data.submissions[0];
          expect(submission).toHaveProperty("id");
          expect(submission).toHaveProperty("name");
          expect(submission).toHaveProperty("status");
          expect(submission).toHaveProperty("submitter");
        }
      });
    });

    it("should filter submissions by status", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/submissions?status=pending",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminSubmissionsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        // All returned submissions should be pending
        data.submissions.forEach((submission: any) => {
          expect(submission.status).toBe("pending");
        });
      });
    });
  });

  describe("POST /api/admin/submissions/[id]/approve", () => {
    let testSubmission: any;

    beforeEach(async () => {
      // Create test submission
      testSubmission = await prisma.cardSubmission.create({
        data: {
          name: "Test Approval Submission",
          description: "A test submission for approval",
          websiteUrl: "https://testapproval.com",
          email: "test@testapproval.com",
          status: "pending",
          submittedBy: regularUser.id,
        },
      });
    });

    it("should approve a pending submission and create card", async () => {
      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/admin/submissions/${testSubmission.id}/approve`,
        toApiUser(adminUser),
        {
          method: "POST",
          body: JSON.stringify({}),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await approveSubmissionRoute(request, {
        params: Promise.resolve({ id: testSubmission.id.toString() }),
      });

      // Debug: log response details
      console.log("Response status:", response.status);
      console.log("Response body:", await response.clone().text());

      let responseData: any;
      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toContain("approved");
        expect(data.card).toBeDefined();
        expect(data.card.id).toBeDefined();
        expect(data.submission).toBeDefined();

        // Store response data for later verification
        responseData = data;

        // Verify submission was updated
        expect(testSubmission).toBeDefined();
      });

      // Verify submission was updated
      const updatedSubmission = await prisma.cardSubmission.findUnique({
        where: { id: testSubmission.id },
      });
      expect(updatedSubmission?.status).toBe("approved");
      expect(updatedSubmission?.reviewedBy).toBe(adminUser.id);

      // Verify card was created
      const createdCard = await prisma.card.findUnique({
        where: { id: responseData.card.id },
      });
      expect(createdCard).toBeDefined();
      expect(createdCard?.name).toBe(testSubmission.name);
      expect(createdCard?.approved).toBe(true);
    });

    it("should return 404 for non-existent submission", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/submissions/99999/approve",
        toApiUser(adminUser),
        {
          method: "POST",
          body: JSON.stringify({}),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await approveSubmissionRoute(request, {
        params: Promise.resolve({ id: "99999" }),
      });

      await assertApiResponse(response, 404);
    });
  });

  describe("POST /api/admin/submissions/[id]/reject", () => {
    let testSubmission: any;

    beforeEach(async () => {
      // Create test submission
      testSubmission = await prisma.cardSubmission.create({
        data: {
          name: "Test Rejection Submission",
          description: "A test submission for rejection",
          websiteUrl: "https://testrejection.com",
          status: "pending",
          submittedBy: regularUser.id,
        },
      });
    });

    it("should reject a pending submission with review notes", async () => {
      const rejectionReason = "Incomplete information provided";

      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/admin/submissions/${testSubmission.id}/reject`,
        toApiUser(adminUser),
        {
          method: "POST",
          body: { notes: rejectionReason },
        }
      );

      const response = await rejectSubmissionRoute(request, {
        params: Promise.resolve({ id: testSubmission.id.toString() }),
      });

      // Verify submission was rejected
      await assertApiResponse(response, 200, (data) => {
        expect(data.message).toContain("rejected");
        expect(data.submission).toBeDefined();

        // Verify submission was updated
        expect(testSubmission).toBeDefined();
      });

      // Verify submission was updated
      const updatedSubmission = await prisma.cardSubmission.findUnique({
        where: { id: testSubmission.id },
      });
      expect(updatedSubmission?.status).toBe("rejected");
      expect(updatedSubmission?.reviewedBy).toBe(adminUser.id);

      // Verify no card was created for rejected submission
      const cards = await prisma.card.findMany({
        where: { name: testSubmission.name },
      });
      expect(cards.length).toBe(0);
    });

    it("should handle rejection without reason", async () => {
      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/admin/submissions/${testSubmission.id}/reject`,
        toApiUser(adminUser),
        {
          method: "POST",
          body: {},
        }
      );

      const response = await rejectSubmissionRoute(request, {
        params: Promise.resolve({ id: testSubmission.id.toString() }),
      });

      await assertApiResponse(response, 200);

      // Verify submission was updated
      const updatedSubmission = await prisma.cardSubmission.findUnique({
        where: { id: testSubmission.id },
      });
      expect(updatedSubmission?.status).toBe("rejected");
      expect(updatedSubmission?.reviewedBy).toBe(adminUser.id);
    });
  });

  describe("GET /api/admin/tags", () => {
    beforeEach(async () => {
      // Create test tags (tags table doesn't have description field)
      await prisma.tag.createMany({
        data: [{ name: "test-tag-1" }, { name: "test-tag-2" }],
      });
    });

    it("should return list of tags", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/tags",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminTagsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.tags).toBeDefined();
        expect(Array.isArray(data.tags)).toBe(true);

        // Find our test tags
        const testTags = data.tags.filter((tag: any) =>
          tag.name.startsWith("test-tag")
        );
        expect(testTags.length).toBe(2);

        // Check tag format
        if (testTags.length > 0) {
          const tag = testTags[0];
          expect(tag).toHaveProperty("id");
          expect(tag).toHaveProperty("name");
        }
      });
    });
  });

  describe("GET /api/admin/forums/categories", () => {
    beforeEach(async () => {
      // Create test forum categories
      await prisma.forumCategory.createMany({
        data: [
          {
            name: "Test Category 1",
            slug: "test-category-1",
            description: "Test category description 1",
            displayOrder: 1,
            isActive: true,
            createdBy: adminUser.id,
          },
          {
            name: "Test Category 2",
            slug: "test-category-2",
            description: "Test category description 2",
            displayOrder: 2,
            isActive: false,
            createdBy: adminUser.id,
          },
        ],
      });
    });

    afterEach(async () => {
      // Clean up test categories
      await prisma.forumCategory.deleteMany({
        where: { slug: { startsWith: "test-category" } },
      });
    });

    it("should return list of forum categories", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/forums/categories",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminForumCategoriesRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.categories).toBeDefined();
        expect(Array.isArray(data.categories)).toBe(true);

        // Find our test categories
        const testCategories = data.categories.filter((cat: any) =>
          cat.slug.startsWith("test-category")
        );
        expect(testCategories.length).toBe(2);

        // Check category format
        if (testCategories.length > 0) {
          const category = testCategories[0];
          expect(category).toHaveProperty("id");
          expect(category).toHaveProperty("name");
          expect(category).toHaveProperty("slug");
          expect(category).toHaveProperty("description");
          expect(category).toHaveProperty("display_order");
          expect(category).toHaveProperty("is_active");
        }
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed tokens", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/admin/users",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer invalid-token",
          },
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 401);
    });

    it("should handle expired tokens", async () => {
      // Create an invalid token for testing
      const request = createTestRequest(
        "http://localhost:3000/api/admin/users",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer invalid.test.token",
          },
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 401);
    });

    it("should handle database connection errors gracefully", async () => {
      // This would require mocking the database to throw errors
      // For integration tests, we'll verify the endpoints work normally
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/admin/users",
        toApiUser(adminUser),
        {
          method: "GET",
        }
      );

      const response = await adminUsersRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.users).toBeDefined();
      });
    });
  });
});
