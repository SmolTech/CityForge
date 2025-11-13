import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") || "pending";
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      // Build where clause conditionally
      const whereClause = status === "all" ? {} : { status };

      logger.info("Admin fetching category requests", {
        status,
        limit,
        offset,
      });

      const requests = await prisma.forumCategoryRequest.findMany({
        where: whereClause,
        include: {
          requester: {
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
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdDate: "desc",
        },
        skip: offset,
        take: limit,
      });

      const total = await prisma.forumCategoryRequest.count({
        where: whereClause,
      });

      // Transform to match expected response format
      const transformedRequests = requests.map((request) => ({
        id: request.id,
        name: request.name,
        description: request.description,
        justification: request.justification,
        status: request.status,
        created_date:
          request.createdDate?.toISOString() ?? new Date().toISOString(),
        reviewed_date: request.reviewedDate?.toISOString() ?? null,
        review_notes: request.reviewNotes,
        requester: request.requester
          ? {
              id: request.requester.id,
              first_name: request.requester.firstName,
              last_name: request.requester.lastName,
              email: request.requester.email,
            }
          : null,
        reviewer: request.reviewer
          ? {
              id: request.reviewer.id,
              first_name: request.reviewer.firstName,
              last_name: request.reviewer.lastName,
              email: request.reviewer.email,
            }
          : null,
        category: request.category
          ? {
              id: request.category.id,
              name: request.category.name,
              slug: request.category.slug,
            }
          : null,
      }));

      logger.info("Successfully fetched admin category requests", {
        count: transformedRequests.length,
        total,
      });

      return NextResponse.json({
        requests: transformedRequests,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    } catch (error) {
      logger.error("Error fetching category requests", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch category requests",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
