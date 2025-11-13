import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import {
  validateForumCategoryRequest,
  ForumCategoryRequestData,
} from "@/lib/validation/forums";

/**
 * POST /api/forums/category-requests
 * Request a new forum category
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    if (!user.isActive) {
      return NextResponse.json(
        { error: { message: "User not found or inactive", code: 404 } },
        { status: 404 }
      );
    }

    const data = await request.json();

    if (!data) {
      return NextResponse.json(
        { error: { message: "No data provided", code: 400 } },
        { status: 400 }
      );
    }

    // Validate input data
    const validation = validateForumCategoryRequest(data);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            code: 400,
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    const validatedData = validation.data as ForumCategoryRequestData;

    // Check if a similar category already exists
    const existingCategory = await prisma.forumCategory.findFirst({
      where: { name: validatedData.name },
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

    // Check if user already has a pending request for this category
    const existingRequest = await prisma.forumCategoryRequest.findFirst({
      where: {
        name: validatedData.name,
        requestedBy: user.id,
        status: "pending",
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error: {
            message: "You already have a pending request for this category",
            code: 400,
          },
        },
        { status: 400 }
      );
    }

    // Create the category request
    const categoryRequest = await prisma.forumCategoryRequest.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        justification: validatedData.justification,
        requestedBy: user.id,
        status: "pending",
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
      },
    });

    // Format response to match Flask API (snake_case)
    const responseData = {
      id: categoryRequest.id,
      name: categoryRequest.name,
      description: categoryRequest.description,
      justification: categoryRequest.justification,
      status: categoryRequest.status,
      requested_by: categoryRequest.requestedBy,
      reviewed_by: categoryRequest.reviewedBy,
      created_date:
        categoryRequest.createdDate?.toISOString() ?? new Date().toISOString(),
      reviewed_date: categoryRequest.reviewedDate?.toISOString() || null,
      review_notes: categoryRequest.reviewNotes,
      category_id: categoryRequest.categoryId,
      requester: {
        id: categoryRequest.requester.id,
        first_name: categoryRequest.requester.firstName,
        last_name: categoryRequest.requester.lastName,
        email: categoryRequest.requester.email,
      },
    };

    logger.info("Category request created successfully", {
      requestId: categoryRequest.id,
      userId: user.id,
      categoryName: validatedData.name,
    });

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    logger.error("Error creating category request", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: user.id,
    });
    return NextResponse.json(
      { error: { message: "Internal server error", code: 500 } },
      { status: 500 }
    );
  }
});

/**
 * GET /api/forums/category-requests
 * Get user's own category requests
 */
export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    logger.info("Fetching user's category requests", { userId: user.id });

    const requests = await prisma.forumCategoryRequest.findMany({
      where: {
        requestedBy: user.id,
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
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdDate: "desc",
      },
    });

    // Transform to match Flask API format
    const transformedRequests = requests.map((request) => ({
      id: request.id,
      name: request.name,
      description: request.description,
      justification: request.justification,
      status: request.status,
      requested_by: request.requestedBy,
      reviewed_by: request.reviewedBy,
      created_date:
        request.createdDate?.toISOString() ?? new Date().toISOString(),
      reviewed_date: request.reviewedDate?.toISOString() || null,
      review_notes: request.reviewNotes,
      category_id: request.categoryId,
      requester: request.requester
        ? {
            id: request.requester.id,
            first_name: request.requester.firstName,
            last_name: request.requester.lastName,
            email: request.requester.email,
          }
        : null,
      reviewer: request.reviewer
        ? {
            id: request.reviewer.id,
            first_name: request.reviewer.firstName,
            last_name: request.reviewer.lastName,
          }
        : null,
      category: request.category
        ? {
            id: request.category.id,
            name: request.category.name,
            slug: request.category.slug,
          }
        : null,
    }));

    logger.info("Successfully fetched category requests", {
      userId: user.id,
      count: transformedRequests.length,
    });

    return NextResponse.json(transformedRequests);
  } catch (error) {
    logger.error("Error fetching category requests", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: user.id,
    });
    return NextResponse.json(
      { error: { message: "Internal server error", code: 500 } },
      { status: 500 }
    );
  }
});
