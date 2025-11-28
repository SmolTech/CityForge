import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);

      // Build where clause
      const where: {
        status?: string;
      } = {};

      if (status && status !== "all") {
        where.status = status;
      }

      // Get modifications with user and card info
      const [modifications, total] = await Promise.all([
        prisma.cardModification.findMany({
          where,
          include: {
            card: {
              select: {
                id: true,
                name: true,
              },
            },
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
          take: limit,
          skip: offset,
        }),
        prisma.cardModification.count({ where }),
      ]);

      // Transform to match API format
      const transformedModifications = modifications.map((modification) => ({
        id: modification.id,
        card_id: modification.cardId,
        card: modification.card
          ? {
              id: modification.card.id,
              name: modification.card.name,
            }
          : null,
        name: modification.name,
        description: modification.description,
        website_url: modification.websiteUrl,
        phone_number: modification.phoneNumber,
        email: modification.email,
        address: modification.address,
        address_override_url: modification.addressOverrideUrl,
        contact_name: modification.contactName,
        image_url: modification.imageUrl,
        status: modification.status,
        review_notes: modification.reviewNotes,
        created_date: modification.createdDate?.toISOString(),
        submitted_by: modification.submittedBy,
        submitter: modification.submitter
          ? {
              id: modification.submitter.id,
              first_name: modification.submitter.firstName,
              last_name: modification.submitter.lastName,
              email: modification.submitter.email,
            }
          : null,
        reviewed_by: modification.reviewedBy,
        reviewer: modification.reviewer
          ? {
              id: modification.reviewer.id,
              first_name: modification.reviewer.firstName,
              last_name: modification.reviewer.lastName,
              email: modification.reviewer.email,
            }
          : null,
        reviewed_date: modification.reviewedDate?.toISOString(),
      }));

      return NextResponse.json({
        modifications: transformedModifications,
        total,
        limit,
        offset,
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);
