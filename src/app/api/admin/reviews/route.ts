import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);
      const reported = searchParams.get("reported");

      // Build where clause
      const where: {
        reported?: boolean;
      } = {};

      if (reported === "true") {
        where.reported = true;
      }

      // Get reviews with user and card info
      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where,
          include: {
            user: {
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
              },
            },
            reporter: {
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
        prisma.review.count({ where }),
      ]);

      // Transform to match API format
      const transformedReviews = reviews.map((review) => ({
        id: review.id,
        card_id: review.cardId,
        card: review.card
          ? {
              id: review.card.id,
              name: review.card.name,
            }
          : null,
        user_id: review.userId,
        user: review.user
          ? {
              id: review.user.id,
              first_name: review.user.firstName,
              last_name: review.user.lastName,
              email: review.user.email,
            }
          : null,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        reported: review.reported || false,
        reported_by: review.reportedBy,
        reporter: review.reporter
          ? {
              id: review.reporter.id,
              first_name: review.reporter.firstName,
              last_name: review.reporter.lastName,
              email: review.reporter.email,
            }
          : null,
        reported_date: review.reportedDate?.toISOString(),
        reported_reason: review.reportedReason,
        created_date: review.createdDate?.toISOString(),
        hidden: review.hidden || false,
      }));

      return NextResponse.json({
        reviews: transformedReviews,
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
