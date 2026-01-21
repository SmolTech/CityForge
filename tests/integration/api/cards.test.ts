import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { GET as cardsListRoute } from "@/app/api/cards/route";
import { GET as cardDetailsRoute } from "@/app/api/cards/[id]/route";
import { POST as suggestEditRoute } from "@/app/api/cards/[id]/suggest-edit/route";
import { PAGINATION_LIMITS } from "@/lib/constants/pagination";
import {
  createTestRequest,
  createAuthenticatedRequest,
  assertApiResponse,
} from "../../utils/api-test-helpers";
import {
  createTestCardInDb,
  createUniqueTestUser,
  toApiUser,
  testPrisma,
} from "../../utils/database-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
  getTestPrisma,
} from "../setup";
import { Card } from "@/lib/api/types";

// Types for test responses
interface CardsListResponse {
  cards: Card[];
  total: number;
  offset: number;
  limit: number;
}

describe("Cards API Routes", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  beforeAll(async () => {
    await setupIntegrationTests();
    prisma = getTestPrisma();
  }, 60000);

  afterEach(async () => {
    // Clean database after each test to ensure isolation
    await cleanDatabase();
    // Clear any environment variable mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  }, 30000);

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
          (c: Card) => c.name === "Test Restaurant"
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
        expect(data.total).toBe(25);
        expect(data.offset).toBe(10);
        expect(data.limit).toBe(10);
      });
    });

    it("should return empty array when no cards exist", async () => {
      const request = createTestRequest("http://localhost:3000/api/cards");
      const response = await cardsListRoute(request);

      await assertApiResponse(response, 200, (data: CardsListResponse) => {
        expect(data.cards).toBeDefined();
        expect(Array.isArray(data.cards)).toBe(true);
        expect(data.cards).toHaveLength(0);
        expect(data.total).toBe(0);
        expect(data.offset).toBe(0);
        expect(data.limit).toBe(PAGINATION_LIMITS.CARDS_DEFAULT_LIMIT);
      });

      // Check cache headers
      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toBe("public, max-age=60");
    });

    it("should handle search functionality across multiple fields", async () => {
      // Create test user
      const user = await createUniqueTestUser();

      // Create cards with different searchable content
      await createTestCardInDb({
        name: "Coffee Shop",
        description: "Best coffee in town",
        address: "123 Main St",
        userId: user.id,
      });

      await createTestCardInDb({
        name: "Restaurant",
        description: "Italian cuisine",
        address: "456 Oak Ave",
        userId: user.id,
      });

      await createTestCardInDb({
        name: "Tech Startup",
        description: "Software development",
        address: "789 Tech Blvd",
        userId: user.id,
      });

      // Test search by name
      const nameSearchRequest = createTestRequest(
        "http://localhost:3000/api/cards?search=Coffee"
      );
      const nameSearchResponse = await cardsListRoute(nameSearchRequest);

      await assertApiResponse(
        nameSearchResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.cards).toHaveLength(1);
          expect(data.cards[0]?.name).toBe("Coffee Shop");
        }
      );

      // Test search by description
      const descSearchRequest = createTestRequest(
        "http://localhost:3000/api/cards?search=Italian"
      );
      const descSearchResponse = await cardsListRoute(descSearchRequest);

      await assertApiResponse(
        descSearchResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.cards).toHaveLength(1);
          expect(data.cards[0]?.name).toBe("Restaurant");
        }
      );

      // Test case-insensitive search
      const caseInsensitiveRequest = createTestRequest(
        "http://localhost:3000/api/cards?search=COFFEE"
      );
      const caseInsensitiveResponse = await cardsListRoute(
        caseInsensitiveRequest
      );

      await assertApiResponse(
        caseInsensitiveResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.cards).toHaveLength(1);
          expect(data.cards[0]?.name).toBe("Coffee Shop");
        }
      );
    });

    it("should handle tag filtering with AND logic (default)", async () => {
      // Create test user
      const user = await createUniqueTestUser();

      // Create cards with different tag combinations
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const card1 = await createTestCardInDb({
        name: "Tech Business",
        description: "Tech and business",
        tags: ["Technology", "Business"],
        userId: user.id,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const card2 = await createTestCardInDb({
        name: "Art Business",
        description: "Art and business",
        tags: ["Art", "Business"],
        userId: user.id,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const card3 = await createTestCardInDb({
        name: "Restaurant",
        description: "Food establishment",
        tags: ["Food"],
        userId: user.id,
      });

      // Test OR logic (should find cards with Technology OR Art tags)
      const orRequest = createTestRequest(
        "http://localhost:3000/api/cards?tags=Technology&tags=Art&tag_mode=or"
      );
      const orResponse = await cardsListRoute(orRequest);

      await assertApiResponse(
        orResponse,
        200,
        (data: { cards: Array<{ name: string }> }) => {
          expect(data.cards).toHaveLength(2);
          const names = data.cards.map((card) => card.name).sort();
          expect(names).toEqual(["Art Business", "Tech Business"]);
        }
      );
    });

    it("should handle featured filter", async () => {
      // Create test user
      const user = await createUniqueTestUser();

      // Create featured and non-featured cards manually
      await prisma.card.create({
        data: {
          name: "Featured Business",
          description: "This is featured",
          featured: true,
          approved: true,
          createdBy: user.id,
        },
      });

      await prisma.card.create({
        data: {
          name: "Regular Business",
          description: "This is not featured",
          featured: false,
          approved: true,
          createdBy: user.id,
        },
      });

      // Test featured filter
      const featuredRequest = createTestRequest(
        "http://localhost:3000/api/cards?featured=true"
      );
      const featuredResponse = await cardsListRoute(featuredRequest);

      await assertApiResponse(
        featuredResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.cards).toHaveLength(1);
          expect(data.cards[0]?.name).toBe("Featured Business");
          expect(data.cards[0]?.featured).toBe(true);
        }
      );

      // Test without featured filter (should return all, featured first)
      const allRequest = createTestRequest("http://localhost:3000/api/cards");
      const allResponse = await cardsListRoute(allRequest);

      await assertApiResponse(allResponse, 200, (data: CardsListResponse) => {
        expect(data.cards).toHaveLength(2);
        // Featured cards should be sorted first
        expect(data.cards[0]?.featured).toBe(true);
        expect(data.cards[1]?.featured).toBe(false);
      });
    });

    it("should handle share URLs option", async () => {
      // Create test users
      const creator = await createUniqueTestUser();
      const approver = await createUniqueTestUser({ role: "admin" });

      // Create card manually to control approver
      const card = await prisma.card.create({
        data: {
          name: "Test Business & Co.",
          description: "A test business",
          approved: true,
          createdBy: creator.id,
          approvedBy: approver.id,
        },
      });

      // Test with share URLs enabled
      const shareUrlsRequest = createTestRequest(
        "http://localhost:3000/api/cards?share_urls=true"
      );
      const shareUrlsResponse = await cardsListRoute(shareUrlsRequest);

      await assertApiResponse(
        shareUrlsResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.cards).toHaveLength(1);

          const cardData = data.cards[0];
          expect(cardData?.slug).toBe("test-business-co");
          expect(cardData?.share_url).toBe(
            `/business/${card.id}/test-business-co`
          );
          expect(cardData?.creator).toEqual({
            id: creator.id,
            first_name: creator.firstName,
            last_name: creator.lastName,
          });
          expect(cardData?.approver).toEqual({
            id: approver.id,
            first_name: approver.firstName,
            last_name: approver.lastName,
          });
        }
      );

      // Test without share URLs (should not include extra fields)
      const noShareUrlsRequest = createTestRequest(
        "http://localhost:3000/api/cards"
      );
      const noShareUrlsResponse = await cardsListRoute(noShareUrlsRequest);

      await assertApiResponse(
        noShareUrlsResponse,
        200,
        (data: CardsListResponse) => {
          const cardData = data.cards[0];
          expect(cardData?.slug).toBeUndefined();
          expect(cardData?.share_url).toBeUndefined();
          expect(cardData?.creator).toBeUndefined();
          expect(cardData?.approver).toBeUndefined();
        }
      );
    });

    it("should handle ratings aggregation", async () => {
      // Create test user
      const user = await createUniqueTestUser();

      // Create cards
      const cardWithReviews = await createTestCardInDb({
        name: "Rated Business",
        description: "Has ratings",
        userId: user.id,
      });

      await createTestCardInDb({
        name: "Unrated Business",
        description: "No ratings",
        userId: user.id,
      });

      // Create reviews with ratings (rating is required, non-nullable Int)
      await prisma.review.create({
        data: {
          cardId: cardWithReviews.id,
          userId: user.id,
          rating: 5,
          comment: "Excellent!",
        },
      });

      await prisma.review.create({
        data: {
          cardId: cardWithReviews.id,
          userId: user.id,
          rating: 4,
          comment: "Good!",
        },
      });

      // Create a third review to test multiple ratings aggregation
      await prisma.review.create({
        data: {
          cardId: cardWithReviews.id,
          userId: user.id,
          rating: 3,
          comment: "Average",
        },
      });

      // Test with ratings enabled
      const ratingsRequest = createTestRequest(
        "http://localhost:3000/api/cards?ratings=true"
      );
      const ratingsResponse = await cardsListRoute(ratingsRequest);

      await assertApiResponse(
        ratingsResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.cards).toHaveLength(2);

          const ratedCard = data.cards.find(
            (c: Card) => c.name === "Rated Business"
          );
          const unratedCard = data.cards.find(
            (c: Card) => c.name === "Unrated Business"
          );

          // Card with reviews should have aggregated ratings
          expect(ratedCard?.average_rating).toBe(4); // (5 + 4 + 3) / 3 = 4
          expect(ratedCard?.review_count).toBe(3);

          // Card without reviews should have null/0 ratings
          expect(unratedCard?.average_rating).toBeNull();
          expect(unratedCard?.review_count).toBe(0);
        }
      );

      // Test without ratings (should not include rating fields)
      const noRatingsRequest = createTestRequest(
        "http://localhost:3000/api/cards"
      );
      const noRatingsResponse = await cardsListRoute(noRatingsRequest);

      await assertApiResponse(
        noRatingsResponse,
        200,
        (data: CardsListResponse) => {
          data.cards.forEach((card: Card) => {
            expect(card.average_rating).toBeUndefined();
            expect(card.review_count).toBeUndefined();
          });
        }
      );
    });

    it("should enforce pagination limits", async () => {
      // Test with limit exceeding maximum
      const exceedMaxRequest = createTestRequest(
        `http://localhost:3000/api/cards?limit=${PAGINATION_LIMITS.CARDS_MAX_LIMIT + 10}`
      );
      const exceedMaxResponse = await cardsListRoute(exceedMaxRequest);

      await assertApiResponse(
        exceedMaxResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.limit).toBe(PAGINATION_LIMITS.CARDS_MAX_LIMIT);
        }
      );

      // Test with invalid parameters
      const invalidRequest = createTestRequest(
        "http://localhost:3000/api/cards?limit=invalid&offset=invalid"
      );
      const invalidResponse = await cardsListRoute(invalidRequest);

      await assertApiResponse(
        invalidResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.limit).toBe(PAGINATION_LIMITS.CARDS_DEFAULT_LIMIT);
          expect(data.offset).toBe(0);
        }
      );

      // Test with negative values
      const negativeRequest = createTestRequest(
        "http://localhost:3000/api/cards?limit=-1&offset=-1"
      );
      const negativeResponse = await cardsListRoute(negativeRequest);

      await assertApiResponse(
        negativeResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.limit).toBe(PAGINATION_LIMITS.CARDS_DEFAULT_LIMIT);
          expect(data.offset).toBe(0);
        }
      );
    });

    it("should handle complex filtering combinations", async () => {
      // Create test user
      const user = await createUniqueTestUser();

      // Create cards with various combinations
      const card1 = await prisma.card.create({
        data: {
          name: "Featured Tech Business",
          description: "Software development company",
          featured: true,
          approved: true,
          createdBy: user.id,
        },
      });

      // Add tags to card1
      const techTag = await prisma.tag.create({ data: { name: "Technology" } });
      const bizTag = await prisma.tag.create({ data: { name: "Business" } });

      await prisma.card_tags.create({
        data: { card_id: card1.id, tag_id: techTag.id },
      });
      await prisma.card_tags.create({
        data: { card_id: card1.id, tag_id: bizTag.id },
      });

      const card2 = await prisma.card.create({
        data: {
          name: "Regular Tech Company",
          description: "Another software company",
          featured: false,
          approved: true,
          createdBy: user.id,
        },
      });
      await prisma.card_tags.create({
        data: { card_id: card2.id, tag_id: techTag.id },
      });

      await prisma.card.create({
        data: {
          name: "Featured Coffee Shop",
          description: "Great coffee for developers",
          featured: true,
          approved: true,
          createdBy: user.id,
        },
      });

      // Test combination: featured + search + tag filtering
      const complexRequest = createTestRequest(
        "http://localhost:3000/api/cards?featured=true&search=Tech&tags=Technology&tags=Business&tag_mode=and"
      );
      const complexResponse = await cardsListRoute(complexRequest);

      await assertApiResponse(
        complexResponse,
        200,
        (data: CardsListResponse) => {
          expect(data.cards).toHaveLength(1);
          expect(data.cards[0]?.name).toBe("Featured Tech Business");
          expect(data.cards[0]?.featured).toBe(true);
          expect(data.cards[0]?.tags).toContain("Technology");
          expect(data.cards[0]?.tags).toContain("Business");
        }
      );
    });

    it("should handle sorting correctly", async () => {
      // Create test user
      const user = await createUniqueTestUser();

      // Create cards with specific names to test sorting
      await prisma.card.create({
        data: {
          name: "Zebra Company",
          description: "Should be last",
          featured: false,
          approved: true,
          createdBy: user.id,
        },
      });

      await prisma.card.create({
        data: {
          name: "Alpha Business",
          description: "Should be second",
          featured: false,
          approved: true,
          createdBy: user.id,
        },
      });

      await prisma.card.create({
        data: {
          name: "Beta Featured",
          description: "Should be first (featured)",
          featured: true,
          approved: true,
          createdBy: user.id,
        },
      });

      const request = createTestRequest("http://localhost:3000/api/cards");
      const response = await cardsListRoute(request);

      await assertApiResponse(response, 200, (data: CardsListResponse) => {
        expect(data.cards).toHaveLength(3);

        // Should be sorted: featured first, then alphabetical
        expect(data.cards[0]?.name).toBe("Beta Featured");
        expect(data.cards[0]?.featured).toBe(true);

        expect(data.cards[1]?.name).toBe("Alpha Business");
        expect(data.cards[1]?.featured).toBe(false);

        expect(data.cards[2]?.name).toBe("Zebra Company");
        expect(data.cards[2]?.featured).toBe(false);
      });
    });

    it("should include proper response headers", async () => {
      const request = createTestRequest("http://localhost:3000/api/cards");
      const response = await cardsListRoute(request);

      // Check status
      expect(response.status).toBe(200);

      // Check content type
      expect(response.headers.get("Content-Type")).toContain(
        "application/json"
      );

      // Check cache control header (1 minute cache)
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    });

    it("should handle slug generation correctly", async () => {
      // Create test user
      const user = await createUniqueTestUser();

      // Create cards with names that need slug processing
      await prisma.card.create({
        data: {
          name: "Coffee & Tea Shop!",
          description: "Special characters test",
          approved: true,
          createdBy: user.id,
        },
      });

      await prisma.card.create({
        data: {
          name: "   Spaces   &   More   ",
          description: "Spaces and special chars",
          approved: true,
          createdBy: user.id,
        },
      });

      await prisma.card.create({
        data: {
          name: "123 Numbers & Symbols @#$",
          description: "Numbers and symbols",
          approved: true,
          createdBy: user.id,
        },
      });

      const request = createTestRequest(
        "http://localhost:3000/api/cards?share_urls=true"
      );
      const response = await cardsListRoute(request);

      await assertApiResponse(response, 200, (data: CardsListResponse) => {
        expect(data.cards).toHaveLength(3);

        const slugs = data.cards.map((card: Card) => ({
          name: card.name,
          slug: card.slug,
        }));

        expect(slugs).toEqual(
          expect.arrayContaining([
            { name: "Coffee & Tea Shop!", slug: "coffee-tea-shop" },
            { name: "   Spaces   &   More   ", slug: "spaces-more" },
            { name: "123 Numbers & Symbols @#$", slug: "123-numbers-symbols" },
          ])
        );

        // Verify share URLs are correctly formed
        data.cards.forEach((card: Card) => {
          expect(card.share_url).toBe(`/business/${card.id}/${card.slug}`);
        });
      });
    });

    it("should only return approved cards", async () => {
      // Create test user
      const user = await createUniqueTestUser();

      // Create approved card
      await prisma.card.create({
        data: {
          name: "Approved Business",
          description: "This should appear",
          approved: true,
          createdBy: user.id,
        },
      });

      // Create unapproved card
      await prisma.card.create({
        data: {
          name: "Unapproved Business",
          description: "This should not appear",
          approved: false,
          createdBy: user.id,
        },
      });

      const request = createTestRequest("http://localhost:3000/api/cards");
      const response = await cardsListRoute(request);

      await assertApiResponse(response, 200, (data: CardsListResponse) => {
        expect(data.cards).toHaveLength(1);
        expect(data.cards[0]?.name).toBe("Approved Business");
        expect(data.cards[0]?.approved).toBe(true);
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

      await assertApiResponse(response, 403, (data) => {
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe("CSRF_TOKEN_INVALID");
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
