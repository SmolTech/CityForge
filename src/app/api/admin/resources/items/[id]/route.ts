import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";
import { logger } from "@/lib/logger";

/**
 * Admin Resource Item Individual Operations
 * GET: Get specific resource item
 * PUT: Update specific resource item
 * DELETE: Delete specific resource item
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

      const item = await prisma.resourceItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        return NextResponse.json(
          { error: "Resource item not found" },
          { status: 404 }
        );
      }

      const transformedItem = {
        id: item.id,
        title: item.title,
        url: item.url,
        description: item.description,
        category: item.category,
        phone: item.phone,
        address: item.address,
        icon: item.icon,
        display_order: item.displayOrder,
        is_active: item.isActive,
        created_date:
          item.createdDate?.toISOString() ?? new Date().toISOString(),
      };

      return NextResponse.json(transformedItem);
    } catch (error) {
      logger.error("Error getting resource item:", error);
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
        title,
        url,
        description,
        category,
        phone,
        address,
        icon,
        display_order,
        is_active,
      } = body;

      // Check if item exists
      const existingItem = await prisma.resourceItem.findUnique({
        where: { id: itemId },
      });

      if (!existingItem) {
        return NextResponse.json(
          { error: "Resource item not found" },
          { status: 404 }
        );
      }

      // Update item
      const updatedItem = await prisma.resourceItem.update({
        where: { id: itemId },
        data: {
          ...(title && { title }),
          ...(url && { url }),
          ...(description && { description }),
          ...(category && { category }),
          ...(phone !== undefined && { phone: phone || null }),
          ...(address !== undefined && { address: address || null }),
          ...(icon && { icon }),
          ...(display_order !== undefined && { displayOrder: display_order }),
          ...(is_active !== undefined && { isActive: is_active }),
        },
      });

      const transformedItem = {
        id: updatedItem.id,
        title: updatedItem.title,
        url: updatedItem.url,
        description: updatedItem.description,
        category: updatedItem.category,
        phone: updatedItem.phone,
        address: updatedItem.address,
        icon: updatedItem.icon,
        display_order: updatedItem.displayOrder,
        is_active: updatedItem.isActive,
        created_date:
          updatedItem.createdDate?.toISOString() ?? new Date().toISOString(),
      };

      return NextResponse.json({
        message: "Resource item updated successfully",
        item: transformedItem,
      });
    } catch (error) {
      logger.error("Error updating resource item:", error);
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
      const existingItem = await prisma.resourceItem.findUnique({
        where: { id: itemId },
      });

      if (!existingItem) {
        return NextResponse.json(
          { error: "Resource item not found" },
          { status: 404 }
        );
      }

      // Delete item
      await prisma.resourceItem.delete({
        where: { id: itemId },
      });

      return NextResponse.json({
        message: "Resource item deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting resource item:", error);
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);
