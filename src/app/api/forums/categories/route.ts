import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

// GET /api/forums/categories - Get all active forum categories
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeStats =
      searchParams.get("include_stats")?.toLowerCase() === "true";

    logger.info("Fetching forum categories", {
      userId: user.id,
      includeStats,
    });

    // First, let's try a simple query to get basic categories
    const categories = await prisma.forumCategory.findMany({
      where: {
        isActive: true,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    // Transform categories to match Flask API format
    const transformedCategories = categories.map((category: any) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      display_order: category.displayOrder,
      is_active: category.isActive,
      created_date: category.createdDate.toISOString(),
      updated_date: category.updatedDate.toISOString(),
      creator: category.creator
        ? {
            id: category.creator.id,
            first_name: category.creator.firstName,
            last_name: category.creator.lastName,
          }
        : null,
    }));

    logger.info("Successfully fetched forum categories", {
      count: transformedCategories.length,
    });

    const response = NextResponse.json(transformedCategories);
    response.headers.set("Cache-Control", "public, max-age=300");
    return response;
  } catch (error) {
    logger.error("Error fetching forum categories", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error: {
          message: "Failed to fetch forum categories",
          code: 500,
        },
      },
      { status: 500 }
    );
  }
});
