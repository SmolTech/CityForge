import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";
import { logger } from "@/lib/logger";

/**
 * Admin Quick Access Item Individual Operations
 * GET: Get specific quick access item
 * PUT: Update specific quick access item
 * DELETE: Delete specific quick access item
 */

export const GET = withAuth(
  async (
    _request: NextRequest,
    _context,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id, 10);

      if (isNaN(itemId)) {
        return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
      }

      const item = await prisma.quickAccessItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        return NextResponse.json(
          { error: "Quick access item not found" },
          { status: 404 }
        );
      }

      const transformedItem = {
        id: item.id,
        identifier: item.identifier,
        title: item.title,
        subtitle: item.subtitle,
        phone: item.phone,
        color: item.color,
        icon: item.icon,
        display_order: item.displayOrder,
        is_active: item.isActive,
        created_date:
          item.createdDate?.toISOString() ?? new Date().toISOString(),
      };

      return NextResponse.json(transformedItem);
    } catch (error) {
      logger.error("Error getting quick access item:", error);
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);

export const PUT = withAuth(
  async (
    request: NextRequest,
    _context,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id, 10);

      if (isNaN(itemId)) {
        return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
      }

      const body = await request.json();
      const {
        identifier,
        title,
        subtitle,
        phone,
        color,
        icon,
        display_order,
        is_active,
      } = body;

      // Check if item exists
      const existingItem = await prisma.quickAccessItem.findUnique({
        where: { id: itemId },
      });

      if (!existingItem) {
        return NextResponse.json(
          { error: "Quick access item not found" },
          { status: 404 }
        );
      }

      // Check for duplicate identifier if it's being changed
      if (identifier && identifier !== existingItem.identifier) {
        const duplicateItem = await prisma.quickAccessItem.findUnique({
          where: { identifier },
        });

        if (duplicateItem) {
          return NextResponse.json(
            { error: "Identifier already exists" },
            { status: 400 }
          );
        }
      }

      // Update item
      const updatedItem = await prisma.quickAccessItem.update({
        where: { id: itemId },
        data: {
          ...(identifier && { identifier }),
          ...(title && { title }),
          ...(subtitle && { subtitle }),
          ...(phone && { phone }),
          ...(color && { color }),
          ...(icon && { icon }),
          ...(display_order !== undefined && { displayOrder: display_order }),
          ...(is_active !== undefined && { isActive: is_active }),
        },
      });

      const transformedItem = {
        id: updatedItem.id,
        identifier: updatedItem.identifier,
        title: updatedItem.title,
        subtitle: updatedItem.subtitle,
        phone: updatedItem.phone,
        color: updatedItem.color,
        icon: updatedItem.icon,
        display_order: updatedItem.displayOrder,
        is_active: updatedItem.isActive,
        created_date:
          updatedItem.createdDate?.toISOString() ?? new Date().toISOString(),
      };

      return NextResponse.json({
        message: "Quick access item updated successfully",
        item: transformedItem,
      });
    } catch (error) {
      logger.error("Error updating quick access item:", error);
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);

export const DELETE = withAuth(
  async (
    _request: NextRequest,
    _context,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id, 10);

      if (isNaN(itemId)) {
        return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
      }

      // Check if item exists
      const existingItem = await prisma.quickAccessItem.findUnique({
        where: { id: itemId },
      });

      if (!existingItem) {
        return NextResponse.json(
          { error: "Quick access item not found" },
          { status: 404 }
        );
      }

      // Delete item
      await prisma.quickAccessItem.delete({
        where: { id: itemId },
      });

      return NextResponse.json({
        message: "Quick access item deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting quick access item:", error);
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);
