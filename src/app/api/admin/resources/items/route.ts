import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";
import { logger } from "@/lib/logger";

/**
 * Admin Resource Items API endpoints
 * GET: List all resource items (including inactive)
 * POST: Create new resource item
 */

export const GET = withAuth(
  async () => {
    try {
      const items = await prisma.resourceItem.findMany({
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      });

      // Transform to match expected format
      const transformedItems = items.map((item) => ({
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
      }));

      return NextResponse.json(transformedItems);
    } catch (error) {
      logger.error("Error getting admin resource items:", error);
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);

export const POST = withCsrfProtection(
  withAuth(
    async (request: NextRequest) => {
      try {
        const body = await request.json();

        // Validate required fields
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

        if (!title || !url || !description || !category || !icon) {
          return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
          );
        }

        // Create new resource item
        const newItem = await prisma.resourceItem.create({
          data: {
            title,
            url,
            description,
            category,
            phone: phone || null,
            address: address || null,
            icon,
            displayOrder: display_order || 0,
            isActive: is_active !== false, // Default to true
            createdDate: new Date(),
          },
        });

        const transformedItem = {
          id: newItem.id,
          title: newItem.title,
          url: newItem.url,
          description: newItem.description,
          category: newItem.category,
          phone: newItem.phone,
          address: newItem.address,
          icon: newItem.icon,
          display_order: newItem.displayOrder,
          is_active: newItem.isActive,
          created_date:
            newItem.createdDate?.toISOString() ?? new Date().toISOString(),
        };

        return NextResponse.json({
          message: "Resource item created successfully",
          item: transformedItem,
        });
      } catch (error) {
        logger.error("Error creating resource item:", error);
        return handleApiError(error);
      }
    },
    { requireAdmin: true }
  )
);
