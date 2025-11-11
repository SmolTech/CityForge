import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

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
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause for filtering
    const where: any = {
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
        where.tags = {
          some: {
            name: {
              in: tags.map((tag) => tag.toLowerCase()),
              mode: "insensitive",
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
    const transformedCards = cards.map((card: any) => {
      const baseCard: any = {
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
        created_date: card.createdDate.toISOString(),
        updated_date: card.updatedDate.toISOString(),
        approved_date: card.approvedDate?.toISOString(),
        tags: card.card_tags.map((ct: any) => ct.tags.name),
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
          .map((review: any) => review.rating)
          .filter((rating: any) => rating !== null);
        if (ratings.length > 0) {
          const sum = ratings.reduce(
            (acc: any, rating: any) => acc + rating,
            0
          );
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
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
