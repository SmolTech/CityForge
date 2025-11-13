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
});
