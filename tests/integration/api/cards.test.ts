import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as cardsListRoute } from "@/app/api/cards/route";
import { GET as cardDetailsRoute } from "@/app/api/cards/[id]/route";
import { POST as suggestEditRoute } from "@/app/api/cards/[id]/suggest-edit/route";
import {
  createTestRequest,
  createAuthenticatedRequest,
  assertApiResponse,
} from "../../utils/api-test-helpers";
import {
  cleanupTestDatabase,
  disconnectTestDatabase,
  createTestCardInDb,
  createUniqueTestUser,
  toApiUser,
  testPrisma,
} from "../../utils/database-test-helpers";

describe("Cards API Routes", () => {
  beforeAll(async () => {
    // Clean up database before starting tests to ensure clean slate
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("GET /api/cards", () => {
    it("should return list of approved cards", async () => {
      // Create test user and cards for this test
      const testUser = await createUniqueTestUser();

      const card1 = await createTestCardInDb({
        name: "Test Restaurant",
        description: "A great restaurant",
        tags: ["restaurant", "food"],
        userId: testUser.id,
      });

      const card2 = await createTestCardInDb({
        name: "Test Store",
        description: "A retail store",
        tags: ["retail", "shopping"],
        userId: testUser.id,
      });

      const request = createTestRequest("http://localhost:3000/api/cards");
      const response = await cardsListRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.cards).toBeDefined();
        expect(Array.isArray(data.cards)).toBe(true);
        expect(data.cards).toHaveLength(2);
        expect(data.total).toBeDefined();
        expect(data.total).toBe(2);

        const restaurant = data.cards.find(
          (c: any) => c.name === "Test Restaurant"
        );
        expect(restaurant).toBeDefined();
        expect(restaurant.tags).toContain("restaurant");
        expect(restaurant.tags).toContain("food");
      });

      // Cleanup test data
      await testPrisma.card_tags.deleteMany({
        where: { card_id: { in: [card1.id, card2.id] } },
      });
      await testPrisma.card.deleteMany({
        where: { id: { in: [card1.id, card2.id] } },
      });
      await testPrisma.user.delete({ where: { id: testUser.id } });
    });

    it("should filter cards by tag", async () => {
      // Create test user and cards with different tags
      const testUser = await createUniqueTestUser();

      await createTestCardInDb({
        name: "Restaurant",
        tags: ["restaurant"],
        userId: testUser.id,
      });

      await createTestCardInDb({
        name: "Store",
        tags: ["retail"],
        userId: testUser.id,
      });

      const request = createTestRequest(
        "http://localhost:3000/api/cards?tags=restaurant"
      );
      const response = await cardsListRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.cards).toHaveLength(1);
        expect(data.cards[0].name).toBe("Restaurant");
      });
    });

    it("should support pagination", async () => {
      // Create test user and multiple cards
      const testUser = await createUniqueTestUser();

      for (let i = 1; i <= 25; i++) {
        await createTestCardInDb({
          name: `Test Card ${i}`,
          userId: testUser.id,
        });
      }

      const request = createTestRequest(
        "http://localhost:3000/api/cards?limit=10&offset=10"
      );
      const response = await cardsListRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.cards).toHaveLength(10);
        // The total count will include cards from previous tests
        expect(data.total).toBeGreaterThanOrEqual(25);
        expect(data.offset).toBe(10);
        expect(data.limit).toBe(10);
      });
    });
  });

  describe("GET /api/cards/[id]", () => {
    it("should return card details", async () => {
      const testUser = await createUniqueTestUser();

      const card = await createTestCardInDb({
        name: "Test Card Details",
        description: "Detailed description",
        phoneNumber: "555-1234",
        email: "contact@test.com",
        websiteUrl: "https://test.com",
        userId: testUser.id,
      });

      const request = createTestRequest(
        `http://localhost:3000/api/cards/${card.id}`
      );
      const response = await cardDetailsRoute(request, {
        params: Promise.resolve({ id: card.id.toString() }),
      });

      await assertApiResponse(response, 200, (data) => {
        expect(data.id).toBe(card.id);
        expect(data.name).toBe("Test Card Details");
        expect(data.description).toBe("Detailed description");
        expect(data.phone_number).toBe("555-1234");
        expect(data.email).toBe("contact@test.com");
        expect(data.website_url).toBe("https://test.com");
      });
    });

    it("should return 404 for non-existent card", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/cards/99999"
      );
      const response = await cardDetailsRoute(request, {
        params: Promise.resolve({ id: "99999" }),
      });

      await assertApiResponse(response, 404, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toBe("Card not found");
      });
    });

    it("should return 400 for invalid card ID", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/cards/invalid"
      );
      const response = await cardDetailsRoute(request, {
        params: Promise.resolve({ id: "invalid" }),
      });

      await assertApiResponse(response, 400, (data) => {
        expect(data.error).toBeDefined();
      });
    });
  });

  describe("POST /api/cards/[id]/suggest-edit", () => {
    it("should create edit suggestion from authenticated user", async () => {
      const testUser = await createUniqueTestUser();

      const card = await createTestCardInDb({
        name: "Original Name",
        description: "Original description",
        userId: testUser.id,
      });

      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/cards/${card.id}/suggest-edit`,
        toApiUser(testUser),
        {
          method: "POST",
          body: {
            name: "Updated Name",
            description: "Updated description",
            phone_number: "555-9999",
          },
        }
      );

      const response = await suggestEditRoute(request, {
        params: Promise.resolve({ id: card.id.toString() }),
      });

      await assertApiResponse(response, 201, (data) => {
        expect(data.id).toBeDefined();
        expect(data.card_id).toBe(card.id);
        expect(data.name).toBe("Updated Name");
      });
    });

    it("should reject unauthenticated edit suggestion", async () => {
      const testUser = await createUniqueTestUser();

      const card = await createTestCardInDb({
        name: "Test Card",
        userId: testUser.id,
      });

      const request = createTestRequest(
        `http://localhost:3000/api/cards/${card.id}/suggest-edit`,
        {
          method: "POST",
          body: {
            name: "Updated Name",
          },
        }
      );

      const response = await suggestEditRoute(request, {
        params: Promise.resolve({ id: card.id.toString() }),
      });

      await assertApiResponse(response, 401, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toBe("No authentication token provided");
      });
    });

    it("should validate edit suggestion data", async () => {
      const testUser = await createUniqueTestUser();

      const card = await createTestCardInDb({
        name: "Test Card",
        userId: testUser.id,
      });

      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/cards/${card.id}/suggest-edit`,
        toApiUser(testUser),
        {
          method: "POST",
          body: {
            // Name that's too long should fail validation
            name: "a".repeat(256),
          },
        }
      );

      const response = await suggestEditRoute(request, {
        params: Promise.resolve({ id: card.id.toString() }),
      });

      await assertApiResponse(response, 422, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.message).toBe("Validation failed");
      });
    });
  });
});
