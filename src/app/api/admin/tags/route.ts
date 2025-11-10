import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/tags - Get list of all tags with usage counts (admin only)
 */
export const GET = withAuth(
  async () => {
    try {
      // Get all tags with card counts
      const tags = await prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          createdDate: true,
          _count: {
            select: {
              cards: true, // Count of associated cards
            },
          },
        },
        orderBy: { name: "asc" },
      });

      // Format response to match Flask API
      const formattedTags = tags.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        created_date: tag.createdDate,
        card_count: tag._count.cards,
      }));

      return NextResponse.json({
        tags: formattedTags,
        total: tags.length,
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
