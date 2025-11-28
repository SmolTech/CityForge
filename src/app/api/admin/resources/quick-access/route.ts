import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";
import { logger } from "@/lib/logger";

/**
 * Admin Quick Access Items API endpoints
 * GET: List all quick access items (including inactive)
 * POST: Create new quick access item
 */

export const GET = withAuth(
  async () => {
    try {
      const items = await prisma.quickAccessItem.findMany({
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      });

      // Transform to match expected format
      const transformedItems = items.map((item) => ({
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
      }));

      return NextResponse.json(transformedItems);
    } catch (error) {
      logger.error("Error getting admin quick access items:", error);
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);

export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();

      // Validate required fields
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

      if (!identifier || !title || !subtitle || !phone || !color || !icon) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Check for duplicate identifier
      const existingItem = await prisma.quickAccessItem.findUnique({
        where: { identifier },
      });

      if (existingItem) {
        return NextResponse.json(
          { error: "Identifier already exists" },
          { status: 400 }
        );
      }

      // Create new quick access item
      const newItem = await prisma.quickAccessItem.create({
        data: {
          identifier,
          title,
          subtitle,
          phone,
          color,
          icon,
          displayOrder: display_order || 0,
          isActive: is_active !== false, // Default to true
          createdDate: new Date(),
        },
      });

      const transformedItem = {
        id: newItem.id,
        identifier: newItem.identifier,
        title: newItem.title,
        subtitle: newItem.subtitle,
        phone: newItem.phone,
        color: newItem.color,
        icon: newItem.icon,
        display_order: newItem.displayOrder,
        is_active: newItem.isActive,
        created_date:
          newItem.createdDate?.toISOString() ?? new Date().toISOString(),
      };

      return NextResponse.json({
        message: "Quick access item created successfully",
        item: transformedItem,
      });
    } catch (error) {
      logger.error("Error creating quick access item:", error);
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);
