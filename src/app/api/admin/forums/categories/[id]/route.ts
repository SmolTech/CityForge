import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/forums/categories/[id] - Get specific forum category (admin)
 */
export const GET = withAuth(
  async (
    _request: NextRequest,
    _context,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const resolvedParams = await params;
      const categoryId = parseInt(resolvedParams.id);
      if (isNaN(categoryId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid category ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      logger.info("Admin fetching forum category", { categoryId });

      const category = await prisma.forumCategory.findUnique({
        where: { id: categoryId },
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
      });

      if (!category) {
        return NextResponse.json(
          {
            error: {
              message: "Category not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // Calculate post count
      const postCount = await prisma.forumPost.count({
        where: {
          thread: {
            categoryId: category.id,
          },
        },
      });

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
        thread_count: category._count.threads,
        post_count: postCount,
      };

      return NextResponse.json(transformedCategory);
    } catch (error) {
      const resolvedParams = await params;
      logger.error("Error fetching admin forum category", {
        error: error instanceof Error ? error.message : "Unknown error",
        categoryId: resolvedParams.id,
      });
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch forum category",
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
 * PUT /api/admin/forums/categories/[id] - Update forum category
 */
export const PUT = withAuth(
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const resolvedParams = await params;
      const categoryId = parseInt(resolvedParams.id);
      if (isNaN(categoryId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid category ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { name, description, display_order, is_active } = body;

      logger.info("Admin updating forum category", {
        categoryId,
        updates: { name, description, display_order, is_active },
        updatedBy: user.id,
      });

      // Check if category exists
      const existingCategory = await prisma.forumCategory.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        return NextResponse.json(
          {
            error: {
              message: "Category not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // Build update data
      const updateData: {
        updatedDate: Date;
        name?: string;
        slug?: string;
        description?: string;
        displayOrder?: number;
        isActive?: boolean;
      } = {
        updatedDate: new Date(),
      };

      if (name !== undefined) {
        updateData.name = name.trim();
        // Update slug if name changes
        updateData.slug = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();

        // Check if new slug conflicts with another category
        const conflictingCategory = await prisma.forumCategory.findFirst({
          where: {
            slug: updateData.slug,
            id: { not: categoryId },
          },
        });

        if (conflictingCategory) {
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
      }

      if (description !== undefined) {
        updateData.description = description.trim();
      }

      if (display_order !== undefined) {
        updateData.displayOrder = display_order;
      }

      if (is_active !== undefined) {
        updateData.isActive = is_active;
      }

      // Update the category
      const updatedCategory = await prisma.forumCategory.update({
        where: { id: categoryId },
        data: updateData,
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
      });

      // Calculate post count
      const postCount = await prisma.forumPost.count({
        where: {
          thread: {
            categoryId: updatedCategory.id,
          },
        },
      });

      const transformedCategory = {
        id: updatedCategory.id,
        name: updatedCategory.name,
        description: updatedCategory.description,
        slug: updatedCategory.slug,
        display_order: updatedCategory.displayOrder,
        is_active: updatedCategory.isActive,
        created_date:
          updatedCategory.createdDate?.toISOString() ??
          new Date().toISOString(),
        updated_date:
          updatedCategory.updatedDate?.toISOString() ??
          new Date().toISOString(),
        creator: updatedCategory.creator
          ? {
              id: updatedCategory.creator.id,
              first_name: updatedCategory.creator.firstName,
              last_name: updatedCategory.creator.lastName,
            }
          : null,
        thread_count: updatedCategory._count.threads,
        post_count: postCount,
      };

      logger.info("Successfully updated forum category", {
        categoryId,
        name: updatedCategory.name,
      });

      return NextResponse.json(transformedCategory);
    } catch (error) {
      const resolvedParams = await params;
      logger.error("Error updating forum category", {
        error: error instanceof Error ? error.message : "Unknown error",
        categoryId: resolvedParams.id,
      });
      return NextResponse.json(
        {
          error: {
            message: "Failed to update forum category",
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
 * DELETE /api/admin/forums/categories/[id] - Delete forum category
 */
export const DELETE = withAuth(
  async (
    _request: NextRequest,
    { user },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const resolvedParams = await params;
      const categoryId = parseInt(resolvedParams.id);
      if (isNaN(categoryId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid category ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      logger.info("Admin deleting forum category", {
        categoryId,
        deletedBy: user.id,
      });

      // Check if category exists
      const existingCategory = await prisma.forumCategory.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        return NextResponse.json(
          {
            error: {
              message: "Category not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // Use transaction to delete category and all related data
      await prisma.$transaction(async (tx) => {
        // First, delete all posts in threads of this category
        await tx.forumPost.deleteMany({
          where: {
            thread: {
              categoryId: categoryId,
            },
          },
        });

        // Then delete all threads in this category
        await tx.forumThread.deleteMany({
          where: {
            categoryId: categoryId,
          },
        });

        // Finally delete the category itself
        await tx.forumCategory.delete({
          where: { id: categoryId },
        });
      });

      logger.info("Successfully deleted forum category", {
        categoryId,
        name: existingCategory.name,
      });

      return NextResponse.json({
        message: "Category deleted successfully",
      });
    } catch (error) {
      const resolvedParams = await params;
      logger.error("Error deleting forum category", {
        error: error instanceof Error ? error.message : "Unknown error",
        categoryId: resolvedParams.id,
      });
      return NextResponse.json(
        {
          error: {
            message: "Failed to delete forum category",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
