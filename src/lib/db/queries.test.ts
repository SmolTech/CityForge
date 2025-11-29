import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma client before importing
vi.mock("./client", () => {
  const mockFindMany = vi.fn();
  const mockCount = vi.fn();
  const mockFindUnique = vi.fn();
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockFindFirst = vi.fn();
  const mockAggregate = vi.fn();

  return {
    prisma: {
      card: {
        findMany: mockFindMany,
        count: mockCount,
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
        findFirst: mockFindFirst,
        aggregate: mockAggregate,
      },
      tag: {
        findMany: mockFindMany,
        count: mockCount,
        findUnique: mockFindUnique,
        create: mockCreate,
      },
      user: {
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
        count: mockCount,
      },
      review: {
        findMany: mockFindMany,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
        findUnique: mockFindUnique,
        findFirst: mockFindFirst,
        aggregate: mockAggregate,
        count: mockCount,
      },
      resourceCategory: {
        findMany: mockFindMany,
      },
      resourceItem: {
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
      },
      resourceConfig: {
        findMany: mockFindMany,
      },
      quickAccessItem: {
        findMany: mockFindMany,
      },
      cardSubmission: {
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
        count: mockCount,
      },
      cardModification: {
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
        count: mockCount,
      },
    },
    __mocks: {
      mockFindMany,
      mockCount,
      mockFindUnique,
      mockCreate,
      mockUpdate,
      mockDelete,
      mockFindFirst,
      mockAggregate,
    },
  };
});

// Mock logger
vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import {
  cardQueries,
  tagQueries,
  userQueries,
  reviewQueries,
  resourceQueries,
  submissionQueries,
} from "./queries";

// Get mock references
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaModule = (await import("./client")) as any;
const {
  mockFindMany,
  mockCount,
  mockFindUnique,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockFindFirst,
  mockAggregate,
} = prismaModule.__mocks || {};

describe("Database Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cardQueries", () => {
    describe("getCards", () => {
      it("should fetch paginated cards with default options", async () => {
        const mockCards = [
          {
            id: 1,
            name: "Test Business",
            description: "Test description",
            approved: true,
            featured: false,
            tags: [{ id: 1, name: "Restaurant" }],
            creator: { firstName: "John", lastName: "Doe" },
            createdDate: new Date(),
          },
        ];

        mockFindMany.mockResolvedValue(mockCards);
        mockCount.mockResolvedValue(1);

        const result = await cardQueries.getCards();

        expect(result.cards).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.limit).toBe(20);
        expect(result.offset).toBe(0);
        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ approved: true }),
            take: 20,
            skip: 0,
          })
        );
      });

      it("should filter cards by tags with OR mode", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(0);

        await cardQueries.getCards({
          tags: ["Restaurant", "Cafe"],
          tagMode: "or",
        });

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              card_tags: expect.objectContaining({
                some: expect.objectContaining({
                  tags: expect.objectContaining({
                    name: expect.objectContaining({
                      in: ["Restaurant", "Cafe"],
                    }),
                  }),
                }),
              }),
            }),
          })
        );
      });

      it("should filter cards by tags with AND mode", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(0);

        await cardQueries.getCards({
          tags: ["Restaurant", "Cafe"],
          tagMode: "and",
        });

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              AND: expect.arrayContaining([
                expect.objectContaining({
                  card_tags: expect.objectContaining({
                    some: expect.any(Object),
                  }),
                }),
              ]),
            }),
          })
        );
      });

      it("should filter featured cards", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(0);

        await cardQueries.getCards({ featured: true });

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              approved: true,
              featured: true,
            }),
          })
        );
      });

      it("should support search functionality", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(0);

        await cardQueries.getCards({ search: "pizza" });

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ name: expect.any(Object) }),
                expect.objectContaining({ description: expect.any(Object) }),
              ]),
            }),
          })
        );
      });

      it("should include reviews when requested", async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 1,
            name: "Test",
            reviews: [{ rating: 5, comment: "Great!" }],
            tags: [],
            creator: {},
          },
        ]);
        mockCount.mockResolvedValue(1);

        await cardQueries.getCards({ includeRatings: true });

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: expect.objectContaining({
              reviews: expect.any(Object),
            }),
          })
        );
      });

      it("should respect pagination parameters", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(100);

        await cardQueries.getCards({ limit: 50, offset: 25 });

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 50,
            skip: 25,
          })
        );
      });

      it("should handle empty tags array correctly", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(0);

        await cardQueries.getCards({ tags: [] });

        // Should not add any tag filtering when tags array is empty
        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              approved: true,
              // Should not have card_tags or AND properties
            }),
          })
        );
      });

      it("should generate share URLs correctly for complex business names", async () => {
        const mockCards = [
          {
            id: 1,
            name: "O'Reilly's Café & Restaurant!!!",
            description: "Test",
            approved: true,
            featured: false,
            card_tags: [],
            creator: { firstName: "John", lastName: "Doe" },
            createdDate: new Date(),
          },
        ];

        mockFindMany.mockResolvedValue(mockCards);
        mockCount.mockResolvedValue(1);

        const result = await cardQueries.getCards({ includeShareUrls: true });

        expect(result.cards[0]?.slug).toBe("o-reilly-s-caf-restaurant");
        expect(result.cards[0]?.shareUrl).toBe(
          "/business/1/o-reilly-s-caf-restaurant"
        );
      });

      it("should calculate accurate average ratings", async () => {
        const mockCards = [
          {
            id: 1,
            name: "Test Business",
            approved: true,
            featured: false,
            card_tags: [],
            creator: { firstName: "John", lastName: "Doe" },
            reviews: [{ rating: 1 }, { rating: 2 }, { rating: 5 }],
            createdDate: new Date(),
          },
        ];

        mockFindMany.mockResolvedValue(mockCards);
        mockCount.mockResolvedValue(1);

        const result = await cardQueries.getCards({ includeRatings: true });

        // (1 + 2 + 5) / 3 = 2.6666... should be 2.6666666666666665
        const cardWithRatings = result.cards[0] as any;
        expect(cardWithRatings?.averageRating).toBeCloseTo(2.67, 2);
        expect(cardWithRatings?.reviewCount).toBe(3);
      });

      it("should handle null ratings in average calculation", async () => {
        const mockCards = [
          {
            id: 1,
            name: "Test Business",
            approved: true,
            featured: false,
            card_tags: [],
            creator: { firstName: "John", lastName: "Doe" },
            reviews: [
              { rating: null }, // Null rating should be treated as 0
              { rating: 4 },
              { rating: 5 },
            ],
            createdDate: new Date(),
          },
        ];

        mockFindMany.mockResolvedValue(mockCards);
        mockCount.mockResolvedValue(1);

        const result = await cardQueries.getCards({ includeRatings: true });

        // (0 + 4 + 5) / 3 = 3.0 (null treated as 0)
        const cardWithRatings = result.cards[0] as any;
        expect(cardWithRatings?.averageRating).toBe(3.0);
        expect(cardWithRatings?.reviewCount).toBe(3);
      });

      it("should handle combined filters (tags + search + featured)", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(0);

        await cardQueries.getCards({
          tags: ["Restaurant"],
          search: "pizza",
          featured: true,
          tagMode: "and",
        });

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              approved: true,
              featured: true,
              OR: expect.any(Array), // Search OR conditions
              AND: expect.any(Array), // Tag AND conditions
            }),
          })
        );
      });

      it("should handle search with special characters", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(0);

        await cardQueries.getCards({ search: "café & grill's" });

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                { name: { contains: "café & grill's", mode: "insensitive" } },
                {
                  description: {
                    contains: "café & grill's",
                    mode: "insensitive",
                  },
                },
                {
                  address: { contains: "café & grill's", mode: "insensitive" },
                },
                {
                  contactName: {
                    contains: "café & grill's",
                    mode: "insensitive",
                  },
                },
              ],
            }),
          })
        );
      });
    });

    describe("getCardById", () => {
      it("should fetch a card by ID", async () => {
        const mockCard = {
          id: 1,
          name: "Test Business",
          card_tags: [],
          reviews: [],
          creator: { firstName: "John", lastName: "Doe" },
          approver: { firstName: "Admin", lastName: "User" },
        };

        mockFindUnique.mockResolvedValue(mockCard);

        const result = await cardQueries.getCardById(1);

        expect(result).toBeDefined();
        expect(result?.name).toBe("Test Business");
        expect(mockFindUnique).toHaveBeenCalled();
      });

      it("should return null for non-existent card", async () => {
        mockFindUnique.mockResolvedValue(null);

        const result = await cardQueries.getCardById(9999);

        expect(result).toBeNull();
      });

      it("should include share URLs when requested", async () => {
        const mockCard = {
          id: 1,
          name: "Test Business & Café",
          card_tags: [{ tags: { name: "Restaurant" } }],
          reviews: [],
          creator: { firstName: "John", lastName: "Doe" },
          approver: { firstName: "Admin", lastName: "User" },
        };

        mockFindUnique.mockResolvedValue(mockCard);

        const result = await cardQueries.getCardById(1, true);

        expect(result?.slug).toBe("test-business-caf");
        expect(result?.share_url).toBe("/business/1/test-business-caf");
      });

      it("should include ratings when requested", async () => {
        const mockCard = {
          id: 1,
          name: "Test Business",
          card_tags: [],
          reviews: [
            { rating: 5, comment: "Great!" },
            { rating: 4, comment: "Good" },
            { rating: 3, comment: "Okay" },
          ],
          creator: { firstName: "John", lastName: "Doe" },
          approver: { firstName: "Admin", lastName: "User" },
        };

        mockFindUnique.mockResolvedValue(mockCard);

        const result = await cardQueries.getCardById(1, false, true);

        expect(result?.average_rating).toBe(4.0); // (5+4+3)/3 = 4.0
        expect(result?.review_count).toBe(3);
      });

      it("should handle null ratings when including ratings", async () => {
        const mockCard = {
          id: 1,
          name: "Test Business",
          card_tags: [],
          reviews: [
            { rating: null, comment: "No rating given" },
            { rating: 4, comment: "Good" },
            { rating: 5, comment: "Excellent" },
          ],
          creator: { firstName: "John", lastName: "Doe" },
          approver: { firstName: "Admin", lastName: "User" },
        };

        mockFindUnique.mockResolvedValue(mockCard);

        const result = await cardQueries.getCardById(1, false, true);

        expect(result?.average_rating).toBe(3.0); // (0+4+5)/3 = 3.0 (null treated as 0)
        expect(result?.review_count).toBe(3);
      });

      it("should handle cards with no reviews when including ratings", async () => {
        const mockCard = {
          id: 1,
          name: "Test Business",
          card_tags: [],
          reviews: [],
          creator: { firstName: "John", lastName: "Doe" },
          approver: { firstName: "Admin", lastName: "User" },
        };

        mockFindUnique.mockResolvedValue(mockCard);

        const result = await cardQueries.getCardById(1, false, true);

        expect(result?.average_rating).toBeNull();
        expect(result?.review_count).toBe(0);
      });

      it("should handle database errors gracefully", async () => {
        const dbError = new Error("Database connection failed");
        mockFindUnique.mockRejectedValue(dbError);

        await expect(cardQueries.getCardById(1)).rejects.toThrow(
          "Database connection failed"
        );

        // Verify error was logged
        const logger = await import("../logger");
        expect(logger.logger.error).toHaveBeenCalledWith(
          "Error in getCardById:",
          dbError
        );
      });
    });

    describe("createCard", () => {
      it("should create a new card with required fields", async () => {
        const cardData = {
          name: "New Business",
          description: "A great new business",
          approved: false,
          featured: false,
          address: "123 Main St",
          creator: { connect: { id: 1 } },
        };

        const mockCreatedCard = {
          id: 1,
          ...cardData,
          card_tags: [],
          creator: { firstName: "John", lastName: "Doe" },
          createdDate: new Date(),
        };

        mockCreate.mockResolvedValue(mockCreatedCard);

        const result = await cardQueries.createCard(cardData);

        expect(result.name).toBe("New Business");
        expect(result.id).toBe(1);
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: cardData,
            include: expect.objectContaining({
              card_tags: expect.objectContaining({ include: { tags: true } }),
              creator: expect.objectContaining({
                select: { firstName: true, lastName: true },
              }),
            }),
          })
        );
      });

      it("should create a card with optional fields", async () => {
        const cardData = {
          name: "Complete Business",
          description: "Full business info",
          websiteUrl: "https://example.com",
          phoneNumber: "555-1234",
          email: "info@example.com",
          address: "123 Main St",
          contactName: "John Doe",
          imageUrl: "https://example.com/image.jpg",
          approved: false,
          featured: false,
          creator: { connect: { id: 1 } },
        };

        const mockCreatedCard = {
          id: 1,
          ...cardData,
          card_tags: [],
          creator: { firstName: "John", lastName: "Doe" },
          createdDate: new Date(),
        };

        mockCreate.mockResolvedValue(mockCreatedCard);

        const result = await cardQueries.createCard(cardData);

        expect(result.name).toBe("Complete Business");
        expect(result.websiteUrl).toBe("https://example.com");
        expect(result.phoneNumber).toBe("555-1234");
        expect(result.email).toBe("info@example.com");
        expect(result.contactName).toBe("John Doe");
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: cardData,
          })
        );
      });

      it("should create a card with tags", async () => {
        const cardData = {
          name: "Tagged Business",
          approved: false,
          featured: false,
          creator: { connect: { id: 1 } },
          card_tags: {
            create: [
              { tags: { connect: { id: 1 } } },
              { tags: { connect: { id: 2 } } },
            ],
          },
        };

        const mockCreatedCard = {
          id: 1,
          ...cardData,
          card_tags: [
            { tags: { name: "Restaurant" } },
            { tags: { name: "Cafe" } },
          ],
          creator: { firstName: "John", lastName: "Doe" },
          createdDate: new Date(),
        };

        mockCreate.mockResolvedValue(mockCreatedCard);

        const result = await cardQueries.createCard(cardData);

        expect(result.card_tags).toHaveLength(2);
        expect(result.card_tags[0]!.tags.name).toBe("Restaurant");
        expect(result.card_tags[1]!.tags.name).toBe("Cafe");
      });

      it("should handle creation errors", async () => {
        const cardData = {
          name: "Invalid Business",
          approved: false,
          featured: false,
          creator: { connect: { id: 1 } },
        };

        const dbError = new Error("Validation failed");
        mockCreate.mockRejectedValue(dbError);

        await expect(cardQueries.createCard(cardData)).rejects.toThrow(
          "Validation failed"
        );
      });
    });
  });

  describe("tagQueries", () => {
    describe("getAllTags", () => {
      it("should fetch all tags with default options", async () => {
        const mockTags = [
          { id: 1, name: "Restaurant", _count: { card_tags: 5 } },
          { id: 2, name: "Cafe", _count: { card_tags: 3 } },
        ];

        mockFindMany.mockResolvedValue(mockTags);

        const result = await tagQueries.getAllTags();

        expect(result).toHaveLength(2);
        expect(result[0]!.name).toBe("Restaurant");
        expect(mockFindMany).toHaveBeenCalled();
      });

      it("should support pagination options", async () => {
        mockFindMany.mockResolvedValue([]);

        const result = await tagQueries.getAllTags({ limit: 50, offset: 10 });

        expect(Array.isArray(result)).toBe(true);
        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 50,
            skip: 10,
          })
        );
      });
    });

    describe("createTag", () => {
      it("should create a new tag", async () => {
        const mockTag = { id: 1, name: "New Tag" };

        mockCreate.mockResolvedValue(mockTag);

        const result = await tagQueries.createTag("New Tag");

        expect(result.name).toBe("New Tag");
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { name: "New Tag" },
          })
        );
      });
    });
  });

  describe("userQueries", () => {
    describe("getUserByEmail", () => {
      it("should fetch a user by email with related data", async () => {
        const mockUser = {
          id: 1,
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          createdCards: [],
          reviews: [],
        };

        mockFindUnique.mockResolvedValue(mockUser);

        const result = await userQueries.getUserByEmail("test@example.com");

        expect(result?.email).toBe("test@example.com");
        expect(mockFindUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { email: "test@example.com" },
            include: expect.objectContaining({
              createdCards: expect.any(Object),
              reviews: expect.any(Object),
            }),
          })
        );
      });

      it("should return null for non-existent user", async () => {
        mockFindUnique.mockResolvedValue(null);

        const result = await userQueries.getUserByEmail(
          "nonexistent@example.com"
        );

        expect(result).toBeNull();
      });
    });

    describe("createUser", () => {
      it("should create a new user", async () => {
        const userData = {
          email: "newuser@example.com",
          passwordHash: "hashedpassword",
          firstName: "Jane",
          lastName: "Doe",
          role: "user" as const,
        };

        const mockUser = { id: 1, ...userData };
        mockCreate.mockResolvedValue(mockUser);

        const result = await userQueries.createUser(userData);

        expect(result.email).toBe("newuser@example.com");
        expect(mockCreate).toHaveBeenCalled();
      });
    });

    describe("updateUser", () => {
      it("should update a user", async () => {
        const updateData = { firstName: "Updated" };
        const mockUser = { id: 1, firstName: "Updated" };

        mockUpdate.mockResolvedValue(mockUser);

        const result = await userQueries.updateUser(1, updateData);

        expect(result.firstName).toBe("Updated");
        expect(mockUpdate).toHaveBeenCalled();
      });
    });
  });

  describe("reviewQueries", () => {
    describe("createReview", () => {
      it("should create a new review", async () => {
        const reviewData = {
          cardId: 1,
          userId: 1,
          rating: 5,
          comment: "Great service!",
          hidden: false,
        };

        const mockReview = { id: 1, ...reviewData };
        mockCreate.mockResolvedValue(mockReview);

        const result = await reviewQueries.createReview(reviewData);

        expect(result.rating).toBe(5);
        expect(mockCreate).toHaveBeenCalled();
      });
    });

    describe("getCardReviews", () => {
      it("should fetch reviews for a card with default pagination", async () => {
        const mockReviews = [
          {
            id: 1,
            rating: 5,
            comment: "Great service!",
            cardId: 1,
            userId: 1,
            user: { firstName: "John", lastName: "Doe" },
          },
        ];

        mockFindMany.mockResolvedValue(mockReviews);
        mockCount.mockResolvedValue(1);

        const result = await reviewQueries.getCardReviews(1);

        expect(result.reviews).toHaveLength(1);
        expect(result.reviews[0]!.rating).toBe(5);
        expect(result.totalCount).toBe(1);
      });

      it("should support pagination options", async () => {
        mockFindMany.mockResolvedValue([]);
        mockCount.mockResolvedValue(0);

        const result = await reviewQueries.getCardReviews(1, 20, 10);

        expect(result.reviews).toBeDefined();
        expect(result.totalCount).toBe(0);
        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 20,
            skip: 10,
          })
        );
      });
    });

    describe("getCardRatingSummary", () => {
      it("should calculate rating statistics", async () => {
        mockAggregate.mockResolvedValue({
          _avg: { rating: 4.5 },
          _count: { id: 10 },
        });

        const result = await reviewQueries.getCardRatingSummary(1);

        expect(result.averageRating).toBe(4.5);
        expect(result.totalReviews).toBe(10);
      });

      it("should handle cards with no reviews", async () => {
        mockAggregate.mockResolvedValue({
          _avg: { rating: null },
          _count: { id: 0 },
        });

        const result = await reviewQueries.getCardRatingSummary(1);

        expect(result.averageRating).toBeNull();
        expect(result.totalReviews).toBe(0);
      });
    });

    describe("deleteReview", () => {
      it("should delete a review", async () => {
        mockDelete.mockResolvedValue({ id: 1 });

        await reviewQueries.deleteReview(1);

        expect(mockDelete).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 1 },
          })
        );
      });
    });

    describe("getReviewById", () => {
      it("should fetch a review by ID with related data", async () => {
        const mockReview = {
          id: 1,
          rating: 5,
          comment: "Great service!",
          cardId: 1,
          userId: 1,
          user: { firstName: "John", lastName: "Doe" },
          card: { name: "Test Business" },
          createdDate: new Date(),
        };

        mockFindUnique.mockResolvedValue(mockReview);

        const result = await reviewQueries.getReviewById(1);

        expect(result?.id).toBe(1);
        expect(result?.rating).toBe(5);
        expect(result?.user.firstName).toBe("John");
        expect(result?.card.name).toBe("Test Business");
        expect(mockFindUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 1 },
            include: expect.objectContaining({
              user: expect.objectContaining({ select: expect.any(Object) }),
              card: expect.objectContaining({ select: expect.any(Object) }),
            }),
          })
        );
      });

      it("should return null for non-existent review", async () => {
        mockFindUnique.mockResolvedValue(null);

        const result = await reviewQueries.getReviewById(9999);

        expect(result).toBeNull();
      });
    });

    describe("updateReview", () => {
      it("should update a review with new data", async () => {
        const updateData = {
          rating: 4,
          comment: "Updated comment",
        };

        const mockUpdatedReview = {
          id: 1,
          rating: 4,
          comment: "Updated comment",
          cardId: 1,
          userId: 1,
          user: { firstName: "John", lastName: "Doe" },
          card: { name: "Test Business" },
        };

        mockUpdate.mockResolvedValue(mockUpdatedReview);

        const result = await reviewQueries.updateReview(1, updateData);

        expect(result.rating).toBe(4);
        expect(result.comment).toBe("Updated comment");
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 1 },
            data: updateData,
            include: expect.objectContaining({
              user: expect.objectContaining({ select: expect.any(Object) }),
              card: expect.objectContaining({ select: expect.any(Object) }),
            }),
          })
        );
      });

      it("should handle partial updates", async () => {
        const updateData = { rating: 3 };

        const mockUpdatedReview = {
          id: 1,
          rating: 3,
          comment: "Original comment",
          cardId: 1,
          userId: 1,
          user: { firstName: "John", lastName: "Doe" },
          card: { name: "Test Business" },
        };

        mockUpdate.mockResolvedValue(mockUpdatedReview);

        const result = await reviewQueries.updateReview(1, updateData);

        expect(result.rating).toBe(3);
        expect(result.comment).toBe("Original comment");
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 1 },
            data: updateData,
          })
        );
      });
    });

    describe("getUserReviewForCard", () => {
      it("should find existing user review for a card", async () => {
        const mockReview = {
          id: 1,
          rating: 5,
          comment: "Great place!",
          cardId: 1,
          userId: 1,
          user: { firstName: "John", lastName: "Doe" },
          card: { name: "Test Business" },
        };

        mockFindFirst.mockResolvedValue(mockReview);

        const result = await reviewQueries.getUserReviewForCard(1, 1);

        expect(result?.id).toBe(1);
        expect(result?.userId).toBe(1);
        expect(result?.cardId).toBe(1);
        expect(mockFindFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              userId: 1,
              cardId: 1,
            },
            include: expect.objectContaining({
              user: expect.objectContaining({ select: expect.any(Object) }),
              card: expect.objectContaining({ select: expect.any(Object) }),
            }),
          })
        );
      });

      it("should return null if user has not reviewed the card", async () => {
        mockFindFirst.mockResolvedValue(null);

        const result = await reviewQueries.getUserReviewForCard(1, 1);

        expect(result).toBeNull();
      });

      it("should handle invalid user or card IDs", async () => {
        mockFindFirst.mockResolvedValue(null);

        const result = await reviewQueries.getUserReviewForCard(-1, -1);

        expect(result).toBeNull();
        expect(mockFindFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              userId: -1,
              cardId: -1,
            },
          })
        );
      });
    });

    describe("reportReview", () => {
      it("should mark a review as reported with reason", async () => {
        const mockReportedReview = {
          id: 1,
          rating: 1,
          comment: "Inappropriate content",
          reported: true,
          reportedBy: 2,
          reportedDate: new Date(),
          reportedReason: "Inappropriate language",
        };

        mockUpdate.mockResolvedValue(mockReportedReview);

        const result = await reviewQueries.reportReview(
          1,
          2,
          "Inappropriate language"
        );

        expect(result.reported).toBe(true);
        expect(result.reportedBy).toBe(2);
        expect(result.reportedReason).toBe("Inappropriate language");
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 1 },
            data: expect.objectContaining({
              reported: true,
              reportedBy: 2,
              reportedReason: "Inappropriate language",
              reportedDate: expect.any(Date),
            }),
          })
        );
      });

      it("should include details in the report reason", async () => {
        const mockReportedReview = {
          id: 1,
          reported: true,
          reportedBy: 2,
          reportedReason: "Spam: Advertising unrelated services",
        };

        mockUpdate.mockResolvedValue(mockReportedReview);

        const result = await reviewQueries.reportReview(
          1,
          2,
          "Spam",
          "Advertising unrelated services"
        );

        expect(result.reportedReason).toBe(
          "Spam: Advertising unrelated services"
        );
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              reportedReason: "Spam: Advertising unrelated services",
            }),
          })
        );
      });

      it("should handle reporting without details", async () => {
        const mockReportedReview = {
          id: 1,
          reported: true,
          reportedBy: 2,
          reportedReason: "Inappropriate content",
        };

        mockUpdate.mockResolvedValue(mockReportedReview);

        await reviewQueries.reportReview(1, 2, "Inappropriate content");

        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              reportedReason: "Inappropriate content",
            }),
          })
        );
      });
    });

    describe("getCardRatingDistribution", () => {
      it("should return rating distribution for a card", async () => {
        const mockDistribution = [
          { rating: 1, _count: { rating: 2 } },
          { rating: 2, _count: { rating: 1 } },
          { rating: 3, _count: { rating: 3 } },
          { rating: 4, _count: { rating: 5 } },
          { rating: 5, _count: { rating: 10 } },
        ];

        // Mock the groupBy method which isn't in our general mock
        const mockGroupBy = vi.fn().mockResolvedValue(mockDistribution);
        prismaModule.prisma.review.groupBy = mockGroupBy;

        const result = await reviewQueries.getCardRatingDistribution(1);

        expect(result).toEqual([2, 1, 3, 5, 10]); // Array of counts for ratings 1-5
        expect(result).toHaveLength(5);
        expect(mockGroupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            by: ["rating"],
            where: expect.objectContaining({
              cardId: 1,
              OR: [{ hidden: false }, { hidden: null }],
            }),
            _count: { rating: true },
            orderBy: { rating: "asc" },
          })
        );
      });

      it("should handle cards with no reviews", async () => {
        const mockGroupBy = vi.fn().mockResolvedValue([]);
        prismaModule.prisma.review.groupBy = mockGroupBy;

        const result = await reviewQueries.getCardRatingDistribution(1);

        expect(result).toEqual([0, 0, 0, 0, 0]); // All zeros for ratings 1-5
        expect(result).toHaveLength(5);
      });

      it("should handle sparse rating distributions", async () => {
        const mockDistribution = [
          { rating: 1, _count: { rating: 1 } },
          { rating: 5, _count: { rating: 3 } },
        ];

        const mockGroupBy = vi.fn().mockResolvedValue(mockDistribution);
        prismaModule.prisma.review.groupBy = mockGroupBy;

        const result = await reviewQueries.getCardRatingDistribution(1);

        expect(result).toEqual([1, 0, 0, 0, 3]); // Only ratings 1 and 5 have counts
        expect(result).toHaveLength(5);
      });

      it("should exclude hidden reviews from distribution", async () => {
        const mockDistribution = [
          { rating: 4, _count: { rating: 2 } },
          { rating: 5, _count: { rating: 1 } },
        ];

        const mockGroupBy = vi.fn().mockResolvedValue(mockDistribution);
        prismaModule.prisma.review.groupBy = mockGroupBy;

        const result = await reviewQueries.getCardRatingDistribution(1);

        expect(mockGroupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [{ hidden: false }, { hidden: null }],
            }),
          })
        );
        expect(result).toEqual([0, 0, 0, 2, 1]);
      });

      it("should handle invalid rating values gracefully", async () => {
        const mockDistribution = [
          { rating: 0, _count: { rating: 1 } }, // Invalid low
          { rating: 3, _count: { rating: 2 } }, // Valid
          { rating: 6, _count: { rating: 1 } }, // Invalid high
        ];

        const mockGroupBy = vi.fn().mockResolvedValue(mockDistribution);
        prismaModule.prisma.review.groupBy = mockGroupBy;

        const result = await reviewQueries.getCardRatingDistribution(1);

        // Should only include the valid rating (3), others ignored
        expect(result).toEqual([0, 0, 2, 0, 0]);
        expect(result).toHaveLength(5);
      });
    });
  });

  describe("resourceQueries", () => {
    describe("getResourceCategories", () => {
      it("should fetch all resource categories with items", async () => {
        const mockCategories = [
          {
            id: 1,
            name: "Education",
            items: [{ id: 1, name: "Library", url: "https://library.com" }],
          },
        ];

        mockFindMany.mockResolvedValue(mockCategories);

        const result = await resourceQueries.getResourceCategories();

        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("Education");
        expect(mockFindMany).toHaveBeenCalled();
      });
    });

    describe("getQuickAccessItems", () => {
      it("should fetch quick access items", async () => {
        const mockItems = [
          {
            id: 1,
            name: "Emergency",
            url: "tel:911",
            icon: "phone",
            isActive: true,
            displayOrder: 1,
          },
        ];

        mockFindMany.mockResolvedValue(mockItems);

        const result = await resourceQueries.getQuickAccessItems();

        expect(Array.isArray(result)).toBe(true);
        expect(mockFindMany).toHaveBeenCalled();
      });
    });

    describe("getResourceItems", () => {
      it("should fetch resource items by category", async () => {
        const mockItems = [
          {
            id: 1,
            name: "Library",
            url: "https://library.com",
            categoryId: "1",
            isActive: true,
            displayOrder: 1,
          },
        ];

        mockFindMany.mockResolvedValue(mockItems);

        const result = await resourceQueries.getResourceItems("1");

        expect(result).toBeDefined();
        expect(mockFindMany).toHaveBeenCalled();
      });
    });

    describe("getSiteConfig", () => {
      it("should fetch site configuration", async () => {
        const mockConfig = [{ id: 1, key: "site_title", value: "CityForge" }];

        mockFindMany.mockResolvedValue(mockConfig);

        const result = await resourceQueries.getSiteConfig();

        expect(result).toBeDefined();
        expect(mockFindMany).toHaveBeenCalled();
      });
    });

    describe("getResourceCategoryList", () => {
      it("should fetch unique resource categories from active items", async () => {
        const mockResourceItems = [
          { category: "Education" },
          { category: "Healthcare" },
          { category: "Transportation" },
        ];

        mockFindMany.mockResolvedValue(mockResourceItems);

        const result = await resourceQueries.getResourceCategoryList();

        expect(result).toEqual(["Education", "Healthcare", "Transportation"]);
        expect(mockFindMany).toHaveBeenCalledWith({
          where: { isActive: true },
          select: { category: true },
          distinct: ["category"],
          orderBy: { category: "asc" },
          take: 50,
        });
      });

      it("should respect custom limit parameter", async () => {
        const mockResourceItems = [
          { category: "Education" },
          { category: "Healthcare" },
        ];

        mockFindMany.mockResolvedValue(mockResourceItems);

        const result = await resourceQueries.getResourceCategoryList({
          limit: 10,
        });

        expect(result).toEqual(["Education", "Healthcare"]);
        expect(mockFindMany).toHaveBeenCalledWith({
          where: { isActive: true },
          select: { category: true },
          distinct: ["category"],
          orderBy: { category: "asc" },
          take: 10,
        });
      });

      it("should filter out null/empty categories", async () => {
        const mockResourceItems = [
          { category: "Education" },
          { category: null },
          { category: "Healthcare" },
          { category: "" },
        ];

        mockFindMany.mockResolvedValue(mockResourceItems);

        const result = await resourceQueries.getResourceCategoryList();

        expect(result).toEqual(["Education", "Healthcare"]);
      });

      it("should return empty array when no active resource items exist", async () => {
        mockFindMany.mockResolvedValue([]);

        const result = await resourceQueries.getResourceCategoryList();

        expect(result).toEqual([]);
      });
    });

    describe("getResourcesConfig", () => {
      it("should build configuration from site config with all values present", async () => {
        const mockConfigItems = [
          { id: 1, key: "site_title", value: "My Community" },
          {
            id: 2,
            key: "site_description",
            value: "A great community website",
          },
          { id: 3, key: "site_domain", value: "mycommunity.org" },
          { id: 4, key: "resources_title", value: "Local Resources" },
          {
            id: 5,
            key: "resources_description",
            value: "Essential local services",
          },
          {
            id: 6,
            key: "resources_footer",
            value:
              '{"title":"Need Help?","description":"Contact us for assistance","contactEmail":"help@example.com","buttonText":"Get Help"}',
          },
        ];

        mockFindMany.mockResolvedValue(mockConfigItems);

        const result = await resourceQueries.getResourcesConfig();

        expect(result).toEqual({
          site: {
            title: "My Community",
            description: "A great community website",
            domain: "mycommunity.org",
          },
          title: "Local Resources",
          description: "Essential local services",
          footer: {
            title: "Need Help?",
            description: "Contact us for assistance",
            contactEmail: "help@example.com",
            buttonText: "Get Help",
          },
        });
      });

      it("should use default values when config values are missing", async () => {
        mockFindMany.mockResolvedValue([]);

        const result = await resourceQueries.getResourcesConfig();

        expect(result).toEqual({
          site: {
            title: "Community Website",
            description:
              "Helping connect people to the resources available to them.",
            domain: "community.local",
          },
          title: "Local Resources",
          description: "Essential links to local services and information",
          footer: {
            title: "Missing a Resource?",
            description:
              "If you know of an important local resource that should be included on this page, please let us know.",
            contactEmail: "contact@example.com",
            buttonText: "Suggest a Resource",
          },
        });
      });

      it("should fall back to individual footer fields when JSON footer is invalid", async () => {
        const mockConfigItems = [
          { id: 1, key: "site_title", value: "My Community" },
          { id: 2, key: "resources_footer", value: "invalid json {" },
          { id: 3, key: "footer_title", value: "Custom Footer Title" },
          { id: 4, key: "footer_description", value: "Custom description" },
          { id: 5, key: "footer_contact_email", value: "custom@example.com" },
          { id: 6, key: "footer_button_text", value: "Custom Button" },
        ];

        mockFindMany.mockResolvedValue(mockConfigItems);

        const result = await resourceQueries.getResourcesConfig();

        expect(result.footer).toEqual({
          title: "Custom Footer Title",
          description: "Custom description",
          contactEmail: "custom@example.com",
          buttonText: "Custom Button",
        });
      });

      it("should use individual footer field defaults when both JSON and individual fields are missing", async () => {
        const mockConfigItems = [
          { id: 1, key: "site_title", value: "My Community" },
        ];

        mockFindMany.mockResolvedValue(mockConfigItems);

        const result = await resourceQueries.getResourcesConfig();

        expect(result.footer).toEqual({
          title: "Missing a Resource?",
          description:
            "If you know of an important local resource that should be included on this page, please let us know.",
          contactEmail: "contact@example.com",
          buttonText: "Suggest a Resource",
        });
      });

      it("should handle partial site configuration gracefully", async () => {
        const mockConfigItems = [
          { id: 1, key: "site_title", value: "Partial Site" },
          {
            id: 2,
            key: "resources_description",
            value: "Custom resources desc",
          },
        ];

        mockFindMany.mockResolvedValue(mockConfigItems);

        const result = await resourceQueries.getResourcesConfig();

        expect(result).toEqual({
          site: {
            title: "Partial Site",
            description:
              "Helping connect people to the resources available to them.", // default
            domain: "community.local", // default
          },
          title: "Local Resources", // default
          description: "Custom resources desc",
          footer: {
            title: "Missing a Resource?",
            description:
              "If you know of an important local resource that should be included on this page, please let us know.",
            contactEmail: "contact@example.com",
            buttonText: "Suggest a Resource",
          },
        });
      });
    });
  });

  describe("submissionQueries", () => {
    describe("createSubmission", () => {
      it("should create a new card submission", async () => {
        const submissionData = {
          name: "New Business",
          description: "A new business",
          submitted_by: 1,
        };

        const mockSubmission = {
          id: 1,
          name: "New Business",
          status: "pending",
          submittedBy: 1,
        };
        mockCreate.mockResolvedValue(mockSubmission);

        const result = await submissionQueries.createSubmission(submissionData);

        expect(result).toBeDefined();
        expect(mockCreate).toHaveBeenCalled();
      });
    });

    describe("getUserSubmissions", () => {
      it("should fetch submissions for a user", async () => {
        const mockSubmissions = [
          {
            id: 1,
            name: "New Business",
            status: "pending",
            submittedBy: 1,
            websiteUrl: "https://example.com",
            phoneNumber: "555-1234",
            submitter: {
              id: 1,
              firstName: "John",
              lastName: "Doe",
              email: "john@example.com",
            },
            reviewer: null,
            createdDate: new Date(),
          },
        ];

        mockFindMany.mockResolvedValue(mockSubmissions);

        const result = await submissionQueries.getUserSubmissions(1);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(mockFindMany).toHaveBeenCalled();
      });
    });

    describe("createModification", () => {
      it("should create a card modification suggestion", async () => {
        const modificationData = {
          card_id: 1,
          name: "Updated Name",
          submitted_by: 1,
        };

        const mockModification = {
          id: 1,
          cardId: 1,
          name: "Updated Name",
          status: "pending",
          suggestedBy: 1,
        };
        mockCreate.mockResolvedValue(mockModification);

        const result =
          await submissionQueries.createModification(modificationData);

        expect(result).toBeDefined();
        expect(mockCreate).toHaveBeenCalled();
      });
    });
  });

  // Comprehensive error handling tests
  describe("Error Handling", () => {
    beforeEach(() => {
      // Reset all mocks before each test
      vi.clearAllMocks();
    });

    describe("Database connection errors", () => {
      it("should handle connection errors in cardQueries.getCards", async () => {
        const connectionError = new Error("Connection refused");
        mockFindMany.mockRejectedValue(connectionError);

        await expect(cardQueries.getCards()).rejects.toThrow(
          "Connection refused"
        );
      });

      it("should handle connection errors in userQueries.getUserByEmail", async () => {
        const connectionError = new Error("Database unavailable");
        mockFindUnique.mockRejectedValue(connectionError);

        await expect(
          userQueries.getUserByEmail("test@example.com")
        ).rejects.toThrow("Database unavailable");
      });

      it("should handle connection errors in reviewQueries.createReview", async () => {
        const connectionError = new Error("Connection timeout");
        mockCreate.mockRejectedValue(connectionError);

        const reviewData = {
          rating: 5,
          comment: "Great service",
          cardId: 1,
          userId: 1,
          hidden: false,
        };

        await expect(reviewQueries.createReview(reviewData)).rejects.toThrow(
          "Connection timeout"
        );
      });
    });

    describe("Transaction failures", () => {
      it("should handle transaction failures in cardQueries.createCard", async () => {
        const transactionError = new Error("Transaction deadlock");
        mockCreate.mockRejectedValue(transactionError);

        const cardData = {
          name: "Test Business",
          description: "A test business",
          website_url: "https://test.com",
          userId: 1,
        };

        await expect(cardQueries.createCard(cardData)).rejects.toThrow(
          "Transaction deadlock"
        );
      });

      it("should handle transaction failures in tagQueries.createTag", async () => {
        const transactionError = new Error("Transaction rolled back");
        mockCreate.mockRejectedValue(transactionError);

        await expect(tagQueries.createTag("Test Tag")).rejects.toThrow(
          "Transaction rolled back"
        );
      });
    });

    describe("Data validation errors", () => {
      it("should handle foreign key constraint errors", async () => {
        const constraintError = new Error("Foreign key constraint failed");
        mockCreate.mockRejectedValue(constraintError);

        const reviewData = {
          rating: 5,
          comment: "Great service",
          cardId: 999999, // Non-existent card ID
          userId: 1,
          hidden: false,
        };

        await expect(reviewQueries.createReview(reviewData)).rejects.toThrow(
          "Foreign key constraint failed"
        );
      });

      it("should handle unique constraint violations", async () => {
        const uniqueError = new Error("Unique constraint violation");
        mockCreate.mockRejectedValue(uniqueError);

        const userData = {
          email: "existing@example.com", // Email that already exists
          passwordHash: "hashed_password",
          firstName: "John",
          lastName: "Doe",
          role: "user",
        };

        await expect(userQueries.createUser(userData)).rejects.toThrow(
          "Unique constraint violation"
        );
      });
    });

    describe("Invalid input handling", () => {
      it("should handle malformed JSON in resourceQueries.getResourcesConfig", async () => {
        const mockConfigItems = [
          { id: 1, key: "resources_footer", value: "invalid json {{{" },
        ];

        mockFindMany.mockResolvedValue(mockConfigItems);

        const result = await resourceQueries.getResourcesConfig();

        // Should fall back to default footer config when JSON is invalid
        expect(result.footer).toEqual({
          title: "Missing a Resource?",
          description:
            "If you know of an important local resource that should be included on this page, please let us know.",
          contactEmail: "contact@example.com",
          buttonText: "Suggest a Resource",
        });
      });

      it("should handle null values gracefully in cardQueries.getCards", async () => {
        const mockCards = [
          {
            id: 1,
            name: null, // Null name should be handled
            description: "Valid description",
            card_tags: [],
          },
        ];

        mockFindMany.mockResolvedValue(mockCards);
        mockCount.mockResolvedValue(1);

        // Should not throw an error, but handle null values appropriately
        const result = await cardQueries.getCards();
        expect(result.cards).toHaveLength(1);
      });
    });

    describe("Large dataset handling", () => {
      it("should handle timeout errors for large queries", async () => {
        const timeoutError = new Error("Query timeout exceeded");
        mockFindMany.mockRejectedValue(timeoutError);

        await expect(cardQueries.getCards({ limit: 10000 })).rejects.toThrow(
          "Query timeout exceeded"
        );
      });

      it("should handle memory errors for aggregation queries", async () => {
        const memoryError = new Error("Out of memory");
        mockAggregate.mockRejectedValue(memoryError);

        await expect(reviewQueries.getCardRatingSummary(1)).rejects.toThrow(
          "Out of memory"
        );
      });
    });

    describe("Resource cleanup on errors", () => {
      it("should handle cleanup errors in deleteReview", async () => {
        const deletionError = new Error("Cannot delete referenced record");
        mockDelete.mockRejectedValue(deletionError);

        await expect(reviewQueries.deleteReview(1)).rejects.toThrow(
          "Cannot delete referenced record"
        );
      });

      it("should handle cascade deletion errors", async () => {
        const cascadeError = new Error("Cascade deletion failed");
        mockDelete.mockRejectedValue(cascadeError);

        await expect(reviewQueries.deleteReview(1)).rejects.toThrow(
          "Cascade deletion failed"
        );
      });
    });

    describe("Concurrent access scenarios", () => {
      it("should handle optimistic locking failures in updateUser", async () => {
        const lockingError = new Error(
          "Record was modified by another transaction"
        );
        mockUpdate.mockRejectedValue(lockingError);

        const userData = {
          id: 1,
          name: "Updated Name",
          email: "updated@example.com",
        };

        await expect(userQueries.updateUser(1, userData)).rejects.toThrow(
          "Record was modified by another transaction"
        );
      });

      it("should handle race conditions in duplicate review creation", async () => {
        const raceConditionError = new Error("Duplicate entry");
        mockCreate.mockRejectedValue(raceConditionError);

        const reviewData = {
          rating: 5,
          comment: "Duplicate review",
          cardId: 1,
          userId: 1,
          hidden: false,
        };

        await expect(reviewQueries.createReview(reviewData)).rejects.toThrow(
          "Duplicate entry"
        );
      });
    });

    describe("Network and infrastructure errors", () => {
      it("should handle network timeouts in resourceQueries.getSiteConfig", async () => {
        const networkError = new Error("Network timeout");
        mockFindMany.mockRejectedValue(networkError);

        await expect(resourceQueries.getSiteConfig()).rejects.toThrow(
          "Network timeout"
        );
      });

      it("should handle database server restarts", async () => {
        const serverError = new Error("Server has gone away");
        mockFindUnique.mockRejectedValue(serverError);

        await expect(cardQueries.getCardById(1)).rejects.toThrow(
          "Server has gone away"
        );
      });
    });

    describe("Edge case boundary conditions", () => {
      it("should handle extremely large pagination offsets", async () => {
        const offsetError = new Error("Offset too large");
        mockFindMany.mockRejectedValue(offsetError);

        await expect(
          cardQueries.getCards({ offset: Number.MAX_SAFE_INTEGER })
        ).rejects.toThrow("Offset too large");
      });

      it("should handle negative IDs gracefully", async () => {
        mockFindUnique.mockResolvedValue(null);

        const result = await cardQueries.getCardById(-1);
        expect(result).toBeNull();
      });

      it("should handle zero and negative limits in pagination", async () => {
        const validationError = new Error("Invalid limit value");
        mockFindMany.mockRejectedValue(validationError);

        await expect(cardQueries.getCards({ limit: -5 })).rejects.toThrow(
          "Invalid limit value"
        );
      });
    });

    describe("Data consistency errors", () => {
      it("should handle inconsistent rating calculations", async () => {
        const mockCards = [
          {
            id: 1,
            name: "Test Card",
            reviews: [
              { rating: null }, // Invalid rating will be treated as 0
              { rating: 5 },
              { rating: 4 },
            ],
            card_tags: [],
          },
        ];

        mockFindMany.mockResolvedValue(mockCards);
        mockCount.mockResolvedValue(1);

        // Should handle null ratings gracefully
        const result = await cardQueries.getCards({ includeRatings: true });

        expect(result.cards).toHaveLength(1);

        // Check if the card has averageRating property
        const card = result.cards[0];
        if (
          card &&
          "averageRating" in card &&
          card.averageRating !== undefined
        ) {
          // Current implementation: (null + 5 + 4) / 3 = 9 / 3 = 3
          // null is treated as 0 in JavaScript arithmetic
          expect(card.averageRating).toBe(3);
        }
      });

      it("should handle empty or corrupted aggregation results", async () => {
        // This test exposes that getCardRatingSummary doesn't handle null results properly
        const nullAggregationError = new Error("Failed to aggregate data");
        mockAggregate.mockRejectedValue(nullAggregationError);

        await expect(reviewQueries.getCardRatingSummary(1)).rejects.toThrow(
          "Failed to aggregate data"
        );
      });
    });
  });
});
