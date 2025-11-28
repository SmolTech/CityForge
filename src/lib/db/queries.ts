import { prisma } from "./client";
import { logger } from "../logger";
import type { Prisma } from "@prisma/client";

// Card-related queries
export const cardQueries = {
  /**
   * Get cards with optional filtering and pagination
   * Matches Flask API functionality with advanced filtering
   */
  async getCards({
    tags = [],
    tagMode = "and",
    featured,
    limit = 20,
    offset = 0,
    search,
    includeShareUrls = false,
    includeRatings = false,
  }: {
    tags?: string[];
    tagMode?: "and" | "or";
    featured?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
    includeShareUrls?: boolean;
    includeRatings?: boolean;
  } = {}) {
    const where: Prisma.CardWhereInput = {
      approved: true,
      ...(featured !== undefined && { featured }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { address: { contains: search, mode: "insensitive" } },
          { contactName: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    // Handle tag filtering
    if (tags.length > 0) {
      if (tagMode === "or") {
        // OR logic: card must have at least one of the selected tags
        where.card_tags = {
          some: {
            tags: {
              name: {
                in: tags,
                mode: "insensitive",
              },
            },
          },
        };
      } else {
        // AND logic (default): card must have all selected tags
        where.AND = tags.map((tag) => ({
          card_tags: {
            some: {
              tags: {
                name: {
                  equals: tag,
                  mode: "insensitive",
                },
              },
            },
          },
        }));
      }
    }

    // Build include object conditionally
    const include = {
      card_tags: { include: { tags: true } },
      creator: { select: { firstName: true, lastName: true } },
      ...(includeRatings && {
        reviews: {
          where: { hidden: false },
          select: {
            rating: true,
            comment: true,
            createdDate: true,
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdDate: "desc" as const },
          take: 5,
        },
      }),
    };

    const [cards, totalCount] = await Promise.all([
      prisma.card.findMany({
        where,
        include,
        orderBy: [{ featured: "desc" }, { name: "asc" }] as const,
        take: limit,
        skip: offset,
      }),
      prisma.card.count({ where }),
    ]);

    // Transform data to match Flask API format
    const transformedCards = cards.map((card) => {
      const baseCard = {
        ...card,
        // Transform card_tags to simple tags array
        tags: card.card_tags?.map((ct) => ct.tags.name) || [],
        // Generate slug if includeShareUrls
        ...(includeShareUrls && {
          slug: card.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, ""),
          shareUrl: `/business/${card.id}/${card.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")}`,
        }),
      };

      // Add rating info if includeRatings and reviews are loaded
      if (includeRatings && "reviews" in card && Array.isArray(card.reviews)) {
        return {
          ...baseCard,
          averageRating:
            card.reviews.length > 0
              ? card.reviews.reduce(
                  (sum, review) => sum + (review.rating ?? 0),
                  0
                ) / card.reviews.length
              : null,
          reviewCount: card.reviews.length,
        };
      }

      return baseCard;
    });

    return {
      cards: transformedCards,
      total: totalCount,
      offset,
      limit,
    };
  },

  /**
   * Get a single card by ID with all related data
   */
  async getCardById(
    id: number,
    includeShareUrls = false,
    includeRatings = false
  ) {
    try {
      const card = await prisma.card.findUnique({
        where: { id, approved: true },
        include: {
          card_tags: { include: { tags: true } },
          reviews: {
            where: { hidden: false },
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdDate: "desc" },
          },
          creator: { select: { firstName: true, lastName: true } },
          approver: { select: { firstName: true, lastName: true } },
        },
      });

      if (!card) return null;

      // Transform data to match Flask API format
      const transformedCard = {
        ...card,
        // Transform card_tags to simple tags array
        tags: card.card_tags?.map((ct) => ct.tags.name) || [],
        // Generate slug if includeShareUrls
        ...(includeShareUrls && {
          slug: card.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, ""),
          shareUrl: `/business/${card.id}/${card.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")}`,
        }),
        // Add rating info if includeRatings
        ...(includeRatings && {
          averageRating:
            card.reviews.length > 0
              ? card.reviews.reduce(
                  (sum, review) => sum + (review.rating ?? 0),
                  0
                ) / card.reviews.length
              : null,
          reviewCount: card.reviews.length,
        }),
      };

      return transformedCard;
    } catch (error) {
      logger.error("Error in getCardById:", error);
      throw error;
    }
  },

  /**
   * Create a new card
   */
  async createCard(data: Prisma.CardCreateInput) {
    return await prisma.card.create({
      data,
      include: {
        card_tags: { include: { tags: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
    });
  },
};

// Tag-related queries
export const tagQueries = {
  /**
   * Get all tags with usage counts
   */
  async getAllTags(options: { limit?: number; offset?: number } = {}) {
    const { limit = 100, offset = 0 } = options;
    return await prisma.tag.findMany({
      take: limit,
      skip: offset,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { card_tags: true },
        },
      },
    });
  },

  /**
   * Create a new tag
   */
  async createTag(name: string) {
    return await prisma.tag.create({
      data: { name },
    });
  },
};

// User-related queries
export const userQueries = {
  /**
   * Get user by email with authentication data
   */
  async getUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        createdCards: { take: 5, orderBy: { createdDate: "desc" } },
        reviews: { take: 5, orderBy: { createdDate: "desc" } },
      },
    });
  },

  /**
   * Create a new user
   */
  async createUser(data: Prisma.UserCreateInput) {
    return await prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdDate: true,
      },
    });
  },

  /**
   * Update user profile
   */
  async updateUser(id: number, data: Prisma.UserUpdateInput) {
    return await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdDate: true,
        lastLogin: true,
      },
    });
  },
};

// Review-related queries
export const reviewQueries = {
  /**
   * Create a new review
   */
  async createReview(data: {
    cardId: number;
    userId: number;
    rating: number;
    title?: string;
    comment?: string;
    hidden: boolean;
  }) {
    const reviewData: {
      cardId: number;
      userId: number;
      rating: number;
      hidden: boolean;
      title?: string;
      comment?: string;
    } = {
      cardId: data.cardId,
      userId: data.userId,
      rating: data.rating,
      hidden: data.hidden,
    };

    // Only add optional fields if defined
    if (data.title) reviewData.title = data.title;
    if (data.comment) reviewData.comment = data.comment;

    return await prisma.review.create({
      data: reviewData,
      include: {
        user: { select: { firstName: true, lastName: true } },
        card: { select: { name: true } },
      },
    });
  },

  /**
   * Get reviews for a card
   */
  async getCardReviews(cardId: number, limit = 10, offset = 0) {
    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where: {
          cardId,
          OR: [{ hidden: false }, { hidden: null }],
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdDate: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.review.count({
        where: {
          cardId,
          OR: [{ hidden: false }, { hidden: null }],
        },
      }),
    ]);

    return {
      reviews,
      totalCount,
      hasMore: offset + reviews.length < totalCount,
    };
  },

  /**
   * Get a single review by ID
   */
  async getReviewById(reviewId: number) {
    return await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        card: { select: { name: true } },
      },
    });
  },

  /**
   * Update a review
   */
  async updateReview(reviewId: number, data: Prisma.ReviewUpdateInput) {
    return await prisma.review.update({
      where: { id: reviewId },
      data,
      include: {
        user: { select: { firstName: true, lastName: true } },
        card: { select: { name: true } },
      },
    });
  },

  /**
   * Delete a review
   */
  async deleteReview(reviewId: number) {
    return await prisma.review.delete({
      where: { id: reviewId },
    });
  },

  /**
   * Check if user has already reviewed a card
   */
  async getUserReviewForCard(userId: number, cardId: number) {
    return await prisma.review.findFirst({
      where: {
        userId,
        cardId,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        card: { select: { name: true } },
      },
    });
  },

  /**
   * Report a review
   */
  async reportReview(
    reviewId: number,
    reporterId: number,
    reason: string,
    details?: string
  ) {
    return await prisma.review.update({
      where: { id: reviewId },
      data: {
        reported: true,
        reportedBy: reporterId,
        reportedDate: new Date(),
        reportedReason: details ? `${reason}: ${details}` : reason,
      },
    });
  },

  /**
   * Get card rating summary (average rating and count)
   */
  async getCardRatingSummary(cardId: number) {
    const result = await prisma.review.aggregate({
      where: {
        cardId,
        OR: [{ hidden: false }, { hidden: null }],
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      averageRating: result._avg.rating
        ? Math.round(result._avg.rating * 10) / 10
        : null,
      totalReviews: result._count.id,
    };
  },

  /**
   * Get rating distribution for a card (for star rating histogram)
   */
  async getCardRatingDistribution(cardId: number) {
    const distribution = await prisma.review.groupBy({
      by: ["rating"],
      where: {
        cardId,
        OR: [{ hidden: false }, { hidden: null }],
      },
      _count: {
        rating: true,
      },
      orderBy: {
        rating: "asc",
      },
    });

    // Convert to array format expected by frontend (5 elements for ratings 1-5)
    const result = Array(5).fill(0);
    distribution.forEach((item) => {
      if (item.rating >= 1 && item.rating <= 5) {
        result[item.rating - 1] = item._count.rating;
      }
    });

    return result;
  },
};

// Resource-related queries
export const resourceQueries = {
  /**
   * Get all resource categories with items
   */
  async getResourceCategories(
    options: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 50, offset = 0 } = options;
    return await prisma.resourceCategory.findMany({
      include: {
        resourceItems: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { displayOrder: "asc" },
      take: limit,
      skip: offset,
    });
  },

  /**
   * Get quick access items (matches Flask API)
   */
  async getQuickAccessItems(options: { limit?: number; offset?: number } = {}) {
    const { limit = 25, offset = 0 } = options;
    const items = await prisma.quickAccessItem.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      take: limit,
      skip: offset,
    });

    // Transform to match Flask API format (to_dict method)
    return items.map((item) => ({
      id: item.id,
      identifier: item.identifier,
      title: item.title,
      subtitle: item.subtitle,
      phone: item.phone,
      color: item.color,
      icon: item.icon,
      display_order: item.displayOrder,
      is_active: item.isActive,
      created_date: item.createdDate?.toISOString() ?? new Date().toISOString(),
    }));
  },

  /**
   * Get resource items (matches Flask API)
   */
  async getResourceItems(
    category?: string,
    options: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 200, offset = 0 } = options;
    const where = {
      isActive: true,
      ...(category && { category }),
    };

    const items = await prisma.resourceItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { title: "asc" }],
      take: limit,
      skip: offset,
    });

    // Transform to match Flask API format (to_dict method)
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      description: item.description,
      category: item.category,
      category_id: item.categoryId,
      phone: item.phone,
      address: item.address,
      icon: item.icon,
      display_order: item.displayOrder,
      is_active: item.isActive,
      created_date: item.createdDate?.toISOString() ?? new Date().toISOString(),
      updated_date: item.updatedDate?.toISOString() ?? new Date().toISOString(),
    }));
  },

  /**
   * Get unique resource categories (matches Flask API)
   */
  async getResourceCategoryList(options: { limit?: number } = {}) {
    const { limit = 50 } = options;
    const result = await prisma.resourceItem.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
      take: limit,
    });

    return result.map((item) => item.category).filter(Boolean);
  },

  /**
   * Get site configuration (matches Flask API)
   */
  async getSiteConfig() {
    const configs = await prisma.resourceConfig.findMany();

    // Convert to key-value object
    return configs.reduce(
      (acc, config) => {
        acc[config.key] = config.value;
        return acc;
      },
      {} as Record<string, string>
    );
  },

  /**
   * Get resources page configuration (matches Flask API)
   */
  async getResourcesConfig() {
    const configDict = await this.getSiteConfig();

    const config = {
      site: {
        title: configDict["site_title"] || "Community Website",
        description:
          configDict["site_description"] ||
          "Helping connect people to the resources available to them.",
        domain: configDict["site_domain"] || "community.local",
      },
      title: configDict["resources_title"] || "Local Resources",
      description:
        configDict["resources_description"] ||
        "Essential links to local services and information",
    };

    // Handle footer configuration
    let footer = null;
    const footerJson = configDict["resources_footer"];
    if (footerJson) {
      try {
        footer = JSON.parse(footerJson);
      } catch {
        // Invalid JSON, fall back to individual fields
        footer = null;
      }
    }

    if (!footer) {
      footer = {
        title: configDict["footer_title"] || "Missing a Resource?",
        description:
          configDict["footer_description"] ||
          "If you know of an important local resource that should be included on this page, please let us know.",
        contactEmail:
          configDict["footer_contact_email"] || "contact@example.com",
        buttonText: configDict["footer_button_text"] || "Suggest a Resource",
      };
    }

    return { ...config, footer };
  },
};

// Submission-related queries
export const submissionQueries = {
  /**
   * Create a new card submission (matches Flask API)
   */
  async createSubmission(data: {
    name: string;
    description?: string;
    website_url?: string;
    phone_number?: string;
    email?: string;
    address?: string;
    address_override_url?: string;
    contact_name?: string;
    image_url?: string;
    tags_text?: string;
    submitted_by: number;
  }) {
    const submission = await prisma.cardSubmission.create({
      data: {
        name: data.name,
        description: data.description || null,
        websiteUrl: data.website_url || null,
        phoneNumber: data.phone_number || null,
        email: data.email || null,
        address: data.address || null,
        addressOverrideUrl: data.address_override_url || null,
        contactName: data.contact_name || null,
        imageUrl: data.image_url || null,
        tagsText: data.tags_text || null,
        submittedBy: data.submitted_by,
        status: "pending",
        createdDate: new Date(),
      },
      include: {
        submitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Transform to match Flask API format (to_dict method)
    return {
      id: submission.id,
      name: submission.name,
      description: submission.description,
      website_url: submission.websiteUrl,
      phone_number: submission.phoneNumber,
      email: submission.email,
      address: submission.address,
      address_override_url: submission.addressOverrideUrl,
      contact_name: submission.contactName,
      image_url: submission.imageUrl,
      tags_text: submission.tagsText,
      status: submission.status,
      review_notes: submission.reviewNotes,
      created_date:
        submission.createdDate?.toISOString() ?? new Date().toISOString(),
      reviewed_date: submission.reviewedDate
        ? submission.reviewedDate.toISOString()
        : null,
      submitter: submission.submitter
        ? {
            id: submission.submitter.id,
            first_name: submission.submitter.firstName,
            last_name: submission.submitter.lastName,
            email: submission.submitter.email,
          }
        : null,
      reviewer: submission.reviewer
        ? {
            id: submission.reviewer.id,
            first_name: submission.reviewer.firstName,
            last_name: submission.reviewer.lastName,
            email: submission.reviewer.email,
          }
        : null,
      card_id: submission.cardId,
    };
  },

  /**
   * Get user's submissions (matches Flask API)
   */
  async getUserSubmissions(userId: number) {
    const submissions = await prisma.cardSubmission.findMany({
      where: { submittedBy: userId },
      include: {
        submitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdDate: "desc" },
    });

    // Transform to match Flask API format (to_dict method)
    return submissions.map((submission) => ({
      id: submission.id,
      name: submission.name,
      description: submission.description,
      website_url: submission.websiteUrl,
      phone_number: submission.phoneNumber,
      email: submission.email,
      address: submission.address,
      address_override_url: submission.addressOverrideUrl,
      contact_name: submission.contactName,
      image_url: submission.imageUrl,
      tags_text: submission.tagsText,
      status: submission.status,
      review_notes: submission.reviewNotes,
      created_date:
        submission.createdDate?.toISOString() ?? new Date().toISOString(),
      reviewed_date: submission.reviewedDate
        ? submission.reviewedDate.toISOString()
        : null,
      submitter: submission.submitter
        ? {
            id: submission.submitter.id,
            first_name: submission.submitter.firstName,
            last_name: submission.submitter.lastName,
            email: submission.submitter.email,
          }
        : null,
      reviewer: submission.reviewer
        ? {
            id: submission.reviewer.id,
            first_name: submission.reviewer.firstName,
            last_name: submission.reviewer.lastName,
            email: submission.reviewer.email,
          }
        : null,
      card_id: submission.cardId,
    }));
  },

  /**
   * Create a card modification suggestion (matches Flask API)
   */
  async createModification(data: {
    card_id: number;
    name: string;
    description?: string;
    website_url?: string;
    phone_number?: string;
    email?: string;
    address?: string;
    address_override_url?: string;
    contact_name?: string;
    image_url?: string;
    tags_text?: string;
    submitted_by: number;
  }) {
    const modification = await prisma.cardModification.create({
      data: {
        cardId: data.card_id,
        name: data.name,
        description: data.description || null,
        websiteUrl: data.website_url || null,
        phoneNumber: data.phone_number || null,
        email: data.email || null,
        address: data.address || null,
        addressOverrideUrl: data.address_override_url || null,
        contactName: data.contact_name || null,
        imageUrl: data.image_url || null,
        tagsText: data.tags_text || null,
        submittedBy: data.submitted_by,
        status: "pending",
        createdDate: new Date(),
      },
      include: {
        submitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        card: {
          select: {
            id: true,
            name: true,
            approved: true,
          },
        },
      },
    });

    // Transform to match Flask API format (to_dict method)
    return {
      id: modification.id,
      card_id: modification.cardId,
      name: modification.name,
      description: modification.description,
      website_url: modification.websiteUrl,
      phone_number: modification.phoneNumber,
      email: modification.email,
      address: modification.address,
      address_override_url: modification.addressOverrideUrl,
      contact_name: modification.contactName,
      image_url: modification.imageUrl,
      tags_text: modification.tagsText,
      status: modification.status,
      review_notes: modification.reviewNotes,
      created_date:
        modification.createdDate?.toISOString() ?? new Date().toISOString(),
      reviewed_date: modification.reviewedDate
        ? modification.reviewedDate.toISOString()
        : null,
      submitter: modification.submitter
        ? {
            id: modification.submitter.id,
            first_name: modification.submitter.firstName,
            last_name: modification.submitter.lastName,
            email: modification.submitter.email,
          }
        : null,
      reviewer: modification.reviewer
        ? {
            id: modification.reviewer.id,
            first_name: modification.reviewer.firstName,
            last_name: modification.reviewer.lastName,
            email: modification.reviewer.email,
          }
        : null,
      card: modification.card
        ? {
            id: modification.card.id,
            name: modification.card.name,
            approved: modification.card.approved,
          }
        : null,
    };
  },
};
