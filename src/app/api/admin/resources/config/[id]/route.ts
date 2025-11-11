import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/resources/config/[id] - Get single resource config (admin only)
 */
export const GET = withAuth(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const configId = parseInt(id, 10);

      if (isNaN(configId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid config ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      const config = await prisma.resourceConfig.findUnique({
        where: { id: configId },
      });

      if (!config) {
        return NextResponse.json(
          {
            error: {
              message: "Config not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: config.id,
        key: config.key,
        value: config.value,
        description: config.description,
        created_date:
          config.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          config.updatedDate?.toISOString() ?? new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error fetching config:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch config",
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
 * PUT /api/admin/resources/config/[id] - Update resource config (admin only)
 */
export const PUT = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const configId = parseInt(id, 10);

      if (isNaN(configId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid config ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { value, description } = body;

      // Validate that at least one field is provided
      if (value === undefined && description === undefined) {
        return NextResponse.json(
          {
            error: {
              message: "At least one field (value or description) is required",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Check if config exists
      const existingConfig = await prisma.resourceConfig.findUnique({
        where: { id: configId },
      });

      if (!existingConfig) {
        return NextResponse.json(
          {
            error: {
              message: "Config not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // Update config
      const updatedConfig = await prisma.resourceConfig.update({
        where: { id: configId },
        data: {
          ...(value !== undefined && { value: value.trim() }),
          ...(description !== undefined && {
            description: description?.trim() || null,
          }),
        },
      });

      return NextResponse.json({
        message: "Config updated successfully",
        config: {
          id: updatedConfig.id,
          key: updatedConfig.key,
          value: updatedConfig.value,
          description: updatedConfig.description,
          created_date:
            updatedConfig.createdDate?.toISOString() ??
            new Date().toISOString(),
          updated_date:
            updatedConfig.updatedDate?.toISOString() ??
            new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error updating config:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to update config",
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
 * DELETE /api/admin/resources/config/[id] - Delete resource config (admin only)
 */
export const DELETE = withAuth(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const configId = parseInt(id, 10);

      if (isNaN(configId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid config ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Check if config exists
      const existingConfig = await prisma.resourceConfig.findUnique({
        where: { id: configId },
      });

      if (!existingConfig) {
        return NextResponse.json(
          {
            error: {
              message: "Config not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // Delete config
      await prisma.resourceConfig.delete({
        where: { id: configId },
      });

      return NextResponse.json({
        message: "Config deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting config:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to delete config",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
