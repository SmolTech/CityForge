import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/forums/category-requests/[id]/approve - Approve a forum category request
 */
export const POST = withCsrfProtection(
  withAuth(
    async (
      _request: NextRequest,
      { user },
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const resolvedParams = await params;
        const requestId = parseInt(resolvedParams.id as string);

        logger.info("Admin approving category request", {
          requestId,
          reviewedBy: user.id,
        });

        // Get the request to verify it exists and is pending
        const categoryRequest = await prisma.forumCategoryRequest.findUnique({
          where: { id: requestId },
          include: {
            requester: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        if (!categoryRequest) {
          return NextResponse.json(
            {
              error: {
                message: "Category request not found",
                code: 404,
              },
            },
            { status: 404 }
          );
        }

        if (categoryRequest.status !== "pending") {
          return NextResponse.json(
            {
              error: {
                message: "Category request is not pending approval",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        // Generate slug from name
        const slug = categoryRequest.name
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

        // Create the category and update the request in a transaction
        const result = await prisma.$transaction(async (tx) => {
          // Create the forum category
          const category = await tx.forumCategory.create({
            data: {
              name: categoryRequest.name,
              description: categoryRequest.description || "",
              slug,
              displayOrder: 0, // Default order
              isActive: true,
              createdBy: user.id, // Admin who approved it
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

          // Update the request status
          const updatedRequest = await tx.forumCategoryRequest.update({
            where: { id: requestId },
            data: {
              status: "approved",
              reviewedBy: user.id,
              reviewedDate: new Date(),
              categoryId: category.id,
            },
            include: {
              requester: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              reviewer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });

          return { category, request: updatedRequest };
        });

        // Transform response to match expected format
        const transformedCategory = {
          id: result.category.id,
          name: result.category.name,
          description: result.category.description,
          slug: result.category.slug,
          display_order: result.category.displayOrder,
          is_active: result.category.isActive,
          created_date:
            result.category.createdDate?.toISOString() ??
            new Date().toISOString(),
          updated_date:
            result.category.updatedDate?.toISOString() ??
            new Date().toISOString(),
          creator: result.category.creator
            ? {
                id: result.category.creator.id,
                first_name: result.category.creator.firstName,
                last_name: result.category.creator.lastName,
              }
            : null,
          thread_count: 0,
          post_count: 0,
        };

        const transformedRequest = {
          id: result.request.id,
          name: result.request.name,
          description: result.request.description,
          justification: result.request.justification,
          status: result.request.status,
          created_date:
            result.request.createdDate?.toISOString() ??
            new Date().toISOString(),
          reviewed_date: result.request.reviewedDate?.toISOString() ?? null,
          review_notes: result.request.reviewNotes,
          requester: result.request.requester
            ? {
                id: result.request.requester.id,
                first_name: result.request.requester.firstName,
                last_name: result.request.requester.lastName,
                email: result.request.requester.email,
              }
            : null,
          reviewer: result.request.reviewer
            ? {
                id: result.request.reviewer.id,
                first_name: result.request.reviewer.firstName,
                last_name: result.request.reviewer.lastName,
                email: result.request.reviewer.email,
              }
            : null,
        };

        logger.info("Successfully approved category request", {
          requestId,
          categoryId: result.category.id,
          categoryName: result.category.name,
        });

        return NextResponse.json({
          message: "Category request approved successfully",
          category: transformedCategory,
          request: transformedRequest,
        });
      } catch (error) {
        const resolvedParams = await params;
        logger.error("Error approving category request", {
          requestId: resolvedParams.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
          {
            error: {
              message: "Failed to approve category request",
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
