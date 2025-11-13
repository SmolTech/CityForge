import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { PAGINATION_LIMITS, paginationUtils } from "@/lib/constants/pagination";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const search = searchParams.get("search")?.trim() || "";
    const tags = searchParams.getAll("tags");
    const tagMode = searchParams.get("tag_mode")?.toLowerCase() || "and";
    const featuredOnly = searchParams.get("featured")?.toLowerCase() === "true";
    const includeShareUrls =
      searchParams.get("share_urls")?.toLowerCase() === "true";
    const includeRatings =
      searchParams.get("ratings")?.toLowerCase() === "true";

    // Enforce query limits to prevent resource exhaustion
    const { limit, offset } = paginationUtils.parseFromSearchParams(
      searchParams,
      PAGINATION_LIMITS.CARDS_MAX_LIMIT,
      PAGINATION_LIMITS.CARDS_DEFAULT_LIMIT
    );

    // Build where clause for filtering
    const where: Prisma.CardWhereInput = {
      approved: true,
    };

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Add featured filter
    if (featuredOnly) {
      where.featured = true;
    }

    // Add tag filters
    if (tags.length > 0) {
      if (tagMode === "or") {
        // OR logic: card must have at least one of the selected tags
        where.card_tags = {
          some: {
            tags: {
              name: {
                in: tags.map((tag) => tag.toLowerCase()),
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
                  contains: tag,
                  mode: "insensitive",
                },
              },
            },
          },
        }));
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.card.count({ where });

    // Fetch cards with tags
    const cards = await prisma.card.findMany({
      where,
      include: {
        card_tags: {
          include: {
            tags: {
              select: {
                name: true,
              },
            },
          },
        },
        creator: includeShareUrls
          ? {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            }
          : false,
        approver: includeShareUrls
          ? {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            }
          : false,
        reviews: includeRatings
          ? {
              select: {
                rating: true,
              },
            }
          : false,
      },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      skip: offset,
      take: limit,
    });

    // Transform cards to match API format
    const transformedCards = cards.map((card) => {
      const baseCard: Record<string, unknown> = {
        id: card.id,
        name: card.name,
        description: card.description,
        website_url: card.websiteUrl,
        phone_number: card.phoneNumber,
        email: card.email,
        address: card.address,
        address_override_url: card.addressOverrideUrl,
        contact_name: card.contactName,
        featured: card.featured,
        image_url: card.imageUrl,
        approved: card.approved,
        created_date: card.createdDate?.toISOString(),
        updated_date: card.updatedDate?.toISOString(),
        approved_date: card.approvedDate?.toISOString(),
        tags: card.card_tags.map((ct) => ct.tags.name),
      };

      // Add optional fields
      if (includeShareUrls) {
        // Generate slug from name (similar to Flask implementation)
        const slug = card.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens

        baseCard.slug = slug;
        baseCard.share_url = `/business/${card.id}/${slug}`;

        if (card.creator) {
          baseCard.creator = {
            id: card.creator.id,
            first_name: card.creator.firstName,
            last_name: card.creator.lastName,
          };
        }

        if (card.approver) {
          baseCard.approver = {
            id: card.approver.id,
            first_name: card.approver.firstName,
            last_name: card.approver.lastName,
          };
        }
      }

      if (includeRatings && card.reviews) {
        const ratings = card.reviews
          .map((review) => review.rating)
          .filter((rating): rating is number => rating !== null);
        if (ratings.length > 0) {
          const sum = ratings.reduce((acc, rating) => acc + rating, 0);
          baseCard.average_rating = sum / ratings.length;
          baseCard.review_count = ratings.length;
        } else {
          baseCard.average_rating = null;
          baseCard.review_count = 0;
        }
      }

      return baseCard;
    });

    const response = NextResponse.json({
      cards: transformedCards,
      total: totalCount,
      offset,
      limit,
    });

    // Add cache headers (1 minute cache like Flask)
    response.headers.set("Cache-Control", "public, max-age=60");

    return response;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching cards:", errorMessage);

    // Only log detailed error information in development
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
      logger.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
