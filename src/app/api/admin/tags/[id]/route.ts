import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/tags/[id] - Get specific tag details (admin only)
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      // Extract ID from URL pathname
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      const idParam = pathParts[pathParts.length - 1];

      if (!idParam || idParam === undefined) {
        return NextResponse.json(
          {
            error: {
              message: "Tag ID is required",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      const tagId = parseInt(idParam, 10);

      if (isNaN(tagId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid tag ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Get tag with card count
      const tag = await prisma.tag.findUnique({
        where: { id: tagId },
        select: {
          id: true,
          name: true,
          createdDate: true,
          _count: {
            select: {
              card_tags: true,
            },
          },
        },
      });

      if (!tag) {
        return NextResponse.json(
          {
            error: {
              message: "Tag not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        tag: {
          id: tag.id,
          name: tag.name,
          created_date: tag.createdDate,
          card_count: tag._count.card_tags,
        },
      });
    } catch (error) {
      logger.error("Error fetching tag:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch tag",
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
 * PUT /api/admin/tags/[id] - Update tag name (admin only)
 */
export const PUT = withCsrfProtection(
  withAuth(
    async (request: NextRequest) => {
      try {
        // Extract ID from URL pathname
        const url = new URL(request.url);
        const pathParts = url.pathname.split("/");
        const idParam = pathParts[pathParts.length - 1];

        if (!idParam || idParam === undefined) {
          return NextResponse.json(
            {
              error: {
                message: "Tag ID is required",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        const tagId = parseInt(idParam, 10);

        if (isNaN(tagId)) {
          return NextResponse.json(
            {
              error: {
                message: "Invalid tag ID",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

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

        // Update tag
        const updatedTag = await prisma.tag.update({
          where: { id: tagId },
          data: { name: tagName },
          select: {
            id: true,
            name: true,
            createdDate: true,
            _count: {
              select: {
                card_tags: true,
              },
            },
          },
        });

        logger.info(`Admin updated tag ID ${tagId} to name "${tagName}"`);

        return NextResponse.json({
          tag: {
            id: updatedTag.id,
            name: updatedTag.name,
            created_date: updatedTag.createdDate,
            card_count: updatedTag._count.card_tags,
          },
          message: "Tag updated successfully",
        });
      } catch (error: unknown) {
        logger.error("Error updating tag:", error);

        // Handle not found
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return NextResponse.json(
            {
              error: {
                message: "Tag not found",
                code: 404,
              },
            },
            { status: 404 }
          );
        }

        // Handle unique constraint violation (duplicate tag name)
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002" &&
          "meta" in error &&
          error.meta &&
          typeof error.meta === "object" &&
          "target" in error.meta &&
          Array.isArray(error.meta.target) &&
          error.meta.target.includes("name")
        ) {
          return NextResponse.json(
            {
              error: {
                message: "Tag name already exists",
                code: 409,
              },
            },
            { status: 409 }
          );
        }

        return NextResponse.json(
          {
            error: {
              message: "Failed to update tag",
              code: 500,
            },
          },
          { status: 500 }
        );
      }
    },
    { requireAdmin: true }
  )
);

/**
 * DELETE /api/admin/tags/[id] - Delete tag and remove from all cards (admin only)
 */
export const DELETE = withCsrfProtection(
  withAuth(
    async (request: NextRequest) => {
      try {
        // Extract ID from URL pathname
        const url = new URL(request.url);
        const pathParts = url.pathname.split("/");
        const idParam = pathParts[pathParts.length - 1];

        if (!idParam || idParam === undefined) {
          return NextResponse.json(
            {
              error: {
                message: "Tag ID is required",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        const tagId = parseInt(idParam, 10);

        if (isNaN(tagId)) {
          return NextResponse.json(
            {
              error: {
                message: "Invalid tag ID",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        // Check if tag exists and get card count
        const existingTag = await prisma.tag.findUnique({
          where: { id: tagId },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                card_tags: true,
              },
            },
          },
        });

        if (!existingTag) {
          return NextResponse.json(
            {
              error: {
                message: "Tag not found",
                code: 404,
              },
            },
            { status: 404 }
          );
        }

        // Delete tag (this will cascade delete card_tags relationships)
        await prisma.tag.delete({
          where: { id: tagId },
        });

        logger.info(
          `Admin deleted tag "${existingTag.name}" (ID: ${tagId}) which was associated with ${existingTag._count.card_tags} cards`
        );

        return NextResponse.json({
          message: `Tag "${existingTag.name}" deleted successfully`,
          cards_affected: existingTag._count.card_tags,
        });
      } catch (error: unknown) {
        logger.error("Error deleting tag:", error);

        // Handle not found
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return NextResponse.json(
            {
              error: {
                message: "Tag not found",
                code: 404,
              },
            },
            { status: 404 }
          );
        }

        return NextResponse.json(
          {
            error: {
              message: "Failed to delete tag",
              code: 500,
            },
          },
          { status: 500 }
        );
      }
    },
    { requireAdmin: true }
  )
);
