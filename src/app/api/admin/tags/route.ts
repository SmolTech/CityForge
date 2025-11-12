import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { PAGINATION_LIMITS, paginationUtils } from "@/lib/constants/pagination";

/**
 * GET /api/admin/tags - Get list of all tags with usage counts (admin only)
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse pagination parameters with enforced limits
      const { limit, offset } = paginationUtils.parseFromSearchParams(
        searchParams,
        PAGINATION_LIMITS.TAGS_MAX_LIMIT,
        PAGINATION_LIMITS.TAGS_DEFAULT_LIMIT
      );

      // Get total count
      const totalCount = await prisma.tag.count();

      // Get tags with card counts
      const tags = await prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          createdDate: true,
          _count: {
            select: {
              card_tags: true, // Count of associated cards
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      });

      // Format response to match Flask API
      const formattedTags = tags.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        created_date: tag.createdDate,
        card_count: tag._count.card_tags,
      }));

      return NextResponse.json({
        tags: formattedTags,
        total: totalCount,
        limit,
        offset,
      });
    } catch (error) {
      logger.error("Error fetching admin tags:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch tags",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

/**
 * POST /api/admin/tags - Create new tag (admin only)
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { name } = body;

      // Validate input
      if (!name || typeof name !== "string") {
        return NextResponse.json(
          {
            error: {
              message: "Tag name is required",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      const tagName = name.trim();
      if (tagName.length === 0 || tagName.length > 50) {
        return NextResponse.json(
          {
            error: {
              message: "Tag name must be between 1 and 50 characters",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Create tag
      const tag = await prisma.tag.create({
        data: { name: tagName },
        select: {
          id: true,
          name: true,
          createdDate: true,
        },
      });

      return NextResponse.json({
        tag: {
          id: tag.id,
          name: tag.name,
          created_date: tag.createdDate,
          card_count: 0,
        },
        message: "Tag created successfully",
      });
    } catch (error: any) {
      logger.error("Error creating tag:", error);

      // Handle unique constraint violation (duplicate tag name)
      if (error.code === "P2002" && error.meta?.target?.includes("name")) {
        return NextResponse.json(
          {
            error: {
              message: "Tag already exists",
              code: 409,
            },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: {
            message: "Failed to create tag",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
