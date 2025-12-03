import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/forums/categories - Get all forum categories for admin (includes inactive)
 */
export const GET = withAuth(
  async () => {
    try {
      logger.info("Admin fetching forum categories");

      // Get all categories (including inactive ones for admin view)
      const categories = await prisma.forumCategory.findMany({
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              threads: true,
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      });

      // For each category, calculate post count by summing posts across all threads
      const categoriesWithStats = await Promise.all(
        categories.map(async (category) => {
          const postCount = await prisma.forumPost.count({
            where: {
              thread: {
                categoryId: category.id,
              },
            },
          });

          return {
            id: category.id,
            name: category.name,
            description: category.description,
            slug: category.slug,
            display_order: category.displayOrder,
            is_active: category.isActive,
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
            thread_count: category._count.threads,
            post_count: postCount,
          };
        })
      );

      logger.info("Successfully fetched admin forum categories", {
        count: categoriesWithStats.length,
      });

      return NextResponse.json({
        categories: categoriesWithStats,
        total: categoriesWithStats.length,
      });
    } catch (error) {
      logger.error("Error fetching admin forum categories", {
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
  },
  { requireAdmin: true }
);

/**
 * POST /api/admin/forums/categories - Create a new forum category
 */
export const POST = withCsrfProtection(
  withAuth(
    async (request: NextRequest, { user }) => {
      try {
        const body = await request.json();
        const { name, description, display_order = 0, is_active = true } = body;

        // Validate required fields
        if (!name || !description) {
          return NextResponse.json(
            {
              error: {
                message: "Name and description are required",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        logger.info("Admin creating forum category", {
          name,
          description,
          display_order,
          is_active,
          createdBy: user.id,
        });

        // Generate slug from name
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();

        // Check if slug already exists
        const existingCategory = await prisma.forumCategory.findUnique({
          where: { slug },
        });

        if (existingCategory) {
          return NextResponse.json(
            {
              error: {
                message: "A category with this name already exists",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        // Create the category
        const category = await prisma.forumCategory.create({
          data: {
            name: name.trim(),
            description: description.trim(),
            slug,
            displayOrder: display_order,
            isActive: is_active,
            createdBy: user.id,
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

        // Transform response to match Flask API format
        const transformedCategory = {
          id: category.id,
          name: category.name,
          description: category.description,
          slug: category.slug,
          display_order: category.displayOrder,
          is_active: category.isActive,
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
          thread_count: 0,
          post_count: 0,
        };

        logger.info("Successfully created forum category", {
          categoryId: category.id,
          name: category.name,
        });

        return NextResponse.json(transformedCategory, { status: 201 });
      } catch (error) {
        logger.error("Error creating forum category", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
          {
            error: {
              message: "Failed to create forum category",
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
