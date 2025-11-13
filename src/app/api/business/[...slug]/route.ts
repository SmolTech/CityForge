import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    // Extract ID and optional slug from dynamic segments
    // URL patterns: /api/business/123 or /api/business/123/some-slug
    const { slug } = await params;
    const segments = slug || [];
    if (segments.length === 0) {
      return NextResponse.json(
        { error: "Business ID required" },
        { status: 400 }
      );
    }

    const [idStr, providedSlug] = segments;

    if (!idStr) {
      return NextResponse.json(
        { error: "Business ID required" },
        { status: 400 }
      );
    }

    const businessId = parseInt(idStr);
    if (isNaN(businessId)) {
      return NextResponse.json(
        { error: "Invalid business ID" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeRatings =
      searchParams.get("ratings")?.toLowerCase() !== "false"; // Default to true for business endpoints

    // Fetch business card with related data
    const card = await prisma.card.findFirst({
      where: {
        id: businessId,
        approved: true,
      },
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
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        reviews: includeRatings
          ? {
              select: {
                rating: true,
              },
            }
          : false,
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Generate slug from name
    const actualSlug = card.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if provided slug matches actual slug (if slug provided)
    if (providedSlug && providedSlug !== actualSlug) {
      return NextResponse.json(
        { redirect: `/business/${businessId}/${actualSlug}` },
        { status: 301 }
      );
    }

    // Transform card to match API format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedCard: any = {
      // Using any for dynamic optional property assignment
      id: card.id,
      name: card.name,
      description: card.description,
      website_url: card.websiteUrl,
      phone_number: card.phoneNumber,
      email: card.email,
      address: card.address,
      address_override_url: card.addressOverrideUrl,
      contact_name: card.contactName,
      featured: card.featured ?? false,
      image_url: card.imageUrl,
      approved: card.approved ?? false,
      tags: card.card_tags.map((ct) => ct.tags.name),
      slug: actualSlug,
      share_url: `/business/${card.id}/${actualSlug}`,
    };

    // Add optional date fields only if defined
    if (card.createdDate)
      transformedCard.created_date = card.createdDate.toISOString();
    if (card.updatedDate)
      transformedCard.updated_date = card.updatedDate.toISOString();
    if (card.approvedDate)
      transformedCard.approved_date = card.approvedDate.toISOString();

    // Add creator and approver info
    if (card.creator) {
      transformedCard.creator = {
        id: card.creator.id,
        first_name: card.creator.firstName,
        last_name: card.creator.lastName,
      };
    }

    if (card.approver) {
      transformedCard.approver = {
        id: card.approver.id,
        first_name: card.approver.firstName,
        last_name: card.approver.lastName,
      };
    }

    // Add ratings if requested
    if (includeRatings && card.reviews) {
      const ratings = card.reviews
        .map((review) => review.rating)
        .filter((rating): rating is number => rating !== null);
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, rating) => acc + rating, 0);
        transformedCard.average_rating = sum / ratings.length;
        transformedCard.review_count = ratings.length;
      } else {
        transformedCard.average_rating = null;
        transformedCard.review_count = 0;
      }
    }

    const response = NextResponse.json(transformedCard);

    // Add cache headers (5 minutes cache like Flask)
    response.headers.set("Cache-Control", "public, max-age=300");

    return response;
  } catch (error) {
    logger.error("Error fetching business:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
