import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/forums/categories/[slug]
 * Get a specific category by slug with statistics (public)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    if (!slug) {
      return NextResponse.json(
        { error: { message: "Category slug is required", code: 400 } },
        { status: 400 }
      );
    }

    logger.info(`Getting category by slug: ${slug}`);

    // Find the category by slug (must be active)
    const category = await prisma.forumCategory.findFirst({
      where: {
        slug: slug,
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
    });

    if (!category) {
      return NextResponse.json(
        { error: { message: "Category not found", code: 404 } },
        { status: 404 }
      );
    }

    // Get thread and post counts for stats using camelCase field names
    const [threadCount, postCount] = await Promise.all([
      prisma.forumThread.count({
        where: { categoryId: category.id },
      }),
      prisma.forumPost.count({
        where: {
          thread: { categoryId: category.id },
        },
      }),
    ]);

    // Format response to match Flask API (snake_case)
    const categoryData = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      is_active: category.isActive,
      display_order: category.displayOrder,
      created_date:
        category.createdDate?.toISOString() ?? new Date().toISOString(),
      updated_date:
        category.updatedDate?.toISOString() ?? new Date().toISOString(),
      creator: category.creator
        ? {
            id: category.creator.id,
            first_name: category.creator.firstName,
            last_name: category.creator.lastName,
          }
        : null,
      thread_count: threadCount,
      post_count: postCount,
    };

    logger.info("Successfully fetched category by slug", {
      categoryId: category.id,
      slug: slug,
      threadCount,
      postCount,
    });

    const response = NextResponse.json(categoryData);

    // Cache for 5 minutes
    response.headers.set("Cache-Control", "public, max-age=300");

    return response;
  } catch (error) {
    logger.error("Error getting category by slug", {
      error: error instanceof Error ? error.message : "Unknown error",
      slug,
    });
    return NextResponse.json(
      { error: { message: "Internal server error", code: 500 } },
      { status: 500 }
    );
  }
}
