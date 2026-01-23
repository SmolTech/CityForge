import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";
import { Prisma } from "@prisma/client";

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search");
      const status = searchParams.get("status"); // approved, pending, all
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);

      // Build where clause
      const where: Prisma.CardWhereInput = {};

      // Add search filter
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { address: { contains: search, mode: "insensitive" } },
          { contactName: { contains: search, mode: "insensitive" } },
        ];
      }

      // Add status filter
      if (status === "approved") {
        where.approved = true;
      } else if (status === "pending") {
        where.approved = false;
      }
      // If status === "all", don't filter by approved

      // Optimized queries with selective loading for better performance
      const [cards, total] = await Promise.all([
        prisma.card.findMany({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            websiteUrl: true,
            phoneNumber: true,
            email: true,
            address: true,
            contactName: true,
            featured: true,
            imageUrl: true,
            approved: true,
            createdDate: true,
            addressOverrideUrl: true,
            updatedDate: true,
            createdBy: true,
            approvedBy: true,
            approvedDate: true,
            // Optimized nested selects instead of includes
            card_tags: {
              select: {
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
                email: true,
              },
            },
            approver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdDate: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.card.count({ where }),
      ]);

      // Transform to match API format
      const transformedCards = cards.map((card) => ({
        id: card.id,
        name: card.name,
        description: card.description,
        website_url: card.websiteUrl,
        phone_number: card.phoneNumber,
        email: card.email,
        address: card.address,
        address_override_url: card.addressOverrideUrl,
        contact_name: card.contactName,
        image_url: card.imageUrl,
        featured: card.featured || false,
        approved: card.approved || false,
        created_date: card.createdDate?.toISOString(),
        updated_date: card.updatedDate?.toISOString(),
        created_by: card.createdBy,
        creator: card.creator
          ? {
              id: card.creator.id,
              first_name: card.creator.firstName,
              last_name: card.creator.lastName,
              email: card.creator.email,
            }
          : null,
        approved_by: card.approvedBy,
        approver: card.approver
          ? {
              id: card.approver.id,
              first_name: card.approver.firstName,
              last_name: card.approver.lastName,
              email: card.approver.email,
            }
          : null,
        approved_date: card.approvedDate?.toISOString(),
        tags: card.card_tags.map((ct) => ct.tags.name),
      }));

      // Return optimized response with caching
      const response = NextResponse.json({
        cards: transformedCards,
        total,
        limit,
        offset,
      });

      // Cache admin responses for 30 seconds to balance freshness and performance
      response.headers.set("Cache-Control", "private, max-age=30, s-maxage=0");

      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);
