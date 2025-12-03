import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/resources/config - Get all resource configs (admin only)
 */
export const GET = withAuth(
  async () => {
    try {
      const configs = await prisma.resourceConfig.findMany({
        orderBy: { key: "asc" },
      });

      const formattedConfigs = configs.map((config) => ({
        id: config.id,
        key: config.key,
        value: config.value,
        description: config.description,
        created_date:
          config.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          config.updatedDate?.toISOString() ?? new Date().toISOString(),
      }));

      return NextResponse.json(formattedConfigs);
    } catch (error) {
      logger.error("Error fetching resource configs:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch resource configs",
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
 * POST /api/admin/resources/config - Create new resource config (admin only)
 */
export const POST = withCsrfProtection(
  withAuth(
    async (request: NextRequest) => {
      try {
        const body = await request.json();
        const { key, value, description } = body;

        // Validate input
        if (!key || typeof key !== "string") {
          return NextResponse.json(
            {
              error: {
                message: "Config key is required",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        if (!value || typeof value !== "string") {
          return NextResponse.json(
            {
              error: {
                message: "Config value is required",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        // Create config
        const config = await prisma.resourceConfig.create({
          data: {
            key: key.trim(),
            value: value.trim(),
            description: description?.trim(),
          },
        });

        return NextResponse.json(
          {
            message: "Config created successfully",
            config: {
              id: config.id,
              key: config.key,
              value: config.value,
              description: config.description,
              created_date:
                config.createdDate?.toISOString() ?? new Date().toISOString(),
              updated_date:
                config.updatedDate?.toISOString() ?? new Date().toISOString(),
            },
          },
          { status: 201 }
        );
      } catch (error: unknown) {
        logger.error("Error creating config:", error);

        // Handle unique constraint violation
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
          error.meta.target.includes("key")
        ) {
          return NextResponse.json(
            {
              error: {
                message: "Config key already exists",
                code: 409,
              },
            },
            { status: 409 }
          );
        }

        return NextResponse.json(
          {
            error: {
              message: "Failed to create config",
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
