import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { validateForumThread, ForumThreadData } from "@/lib/validation/forums";
import { generateSlug } from "@/lib/utils/slugs";

/**
 * GET /api/forums/categories/[slug]/threads
 * Get all threads in a category with pagination (public)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    logger.info(`Getting threads for category: ${slug}`, {
      limit,
      offset,
    });

    // Find the category by slug (must be active)
    const category = await prisma.forumCategory.findFirst({
      where: {
        slug: slug,
        isActive: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: { message: "Category not found", code: 404 } },
        { status: 404 }
      );
    }

    // Get total count
    const totalCount = await prisma.forumThread.count({
      where: { categoryId: category.id },
    });

    // Get threads with authors and first posts (pinned first, then by updated date)
    const threads = await prisma.forumThread.findMany({
      where: { categoryId: category.id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        posts: {
          take: 1,
          where: { isFirstPost: true },
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: { posts: true },
        },
      },
      orderBy: [{ isPinned: "desc" }, { updatedDate: "desc" }],
      skip: offset,
      take: limit,
    });

    // Transform threads to match Flask API format
    const transformedThreads = threads.map((thread: any) => ({
      id: thread.id,
      category_id: thread.categoryId,
      title: thread.title,
      slug: thread.slug,
      is_pinned: thread.isPinned,
      is_locked: thread.isLocked,
      report_count: thread.reportCount,
      created_by: thread.createdBy,
      created_date:
        thread.createdDate?.toISOString() ?? new Date().toISOString(),
      updated_date:
        thread.updatedDate?.toISOString() ?? new Date().toISOString(),
      post_count: thread._count.posts,
      creator: {
        id: thread.creator.id,
        first_name: thread.creator.firstName,
        last_name: thread.creator.lastName,
      },
      first_post: thread.posts[0]
        ? {
            id: thread.posts[0].id,
            content:
              thread.posts[0].content.length > 200
                ? thread.posts[0].content.substring(0, 200) + "..."
                : thread.posts[0].content,
            created_date:
              thread.posts[0].createdDate?.toISOString() ??
              new Date().toISOString(),
            creator: {
              id: thread.posts[0].creator.id,
              first_name: thread.posts[0].creator.firstName,
              last_name: thread.posts[0].creator.lastName,
            },
          }
        : null,
    }));

    // Transform category to match Flask API format
    const transformedCategory = {
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
    };

    const responseData = {
      threads: transformedThreads,
      total: totalCount,
      offset,
      limit,
      category: transformedCategory,
    };

    logger.info("Successfully fetched category threads", {
      categoryId: category.id,
      count: transformedThreads.length,
      total: totalCount,
    });

    const response = NextResponse.json(responseData);

    // Cache for 1 minute (threads change more frequently)
    response.headers.set("Cache-Control", "public, max-age=60");

    return response;
  } catch (error) {
    logger.error("Error fetching category threads", {
      error: error instanceof Error ? error.message : "Unknown error",
      slug,
    });
    return NextResponse.json(
      { error: { message: "Internal server error", code: 500 } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forums/categories/[slug]/threads
 * Create a new thread in a category
 */
export const POST = withAuth(
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ slug: string }> }
  ) => {
    const { slug } = await params;

    try {
      if (!user.isActive) {
        return NextResponse.json(
          { error: { message: "User not found or inactive", code: 404 } },
          { status: 404 }
        );
      }

      // Find the category by slug (must be active)
      const category = await prisma.forumCategory.findFirst({
        where: {
          slug: slug,
          isActive: true,
        },
      });

      if (!category) {
        return NextResponse.json(
          { error: { message: "Category not found", code: 404 } },
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
      const validation = validateForumThread(data);
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

      const validatedData = validation.data as ForumThreadData;

      // Generate unique slug for thread
      const baseSlug = generateSlug(validatedData.title);
      let threadSlug = baseSlug;
      let counter = 1;

      // Ensure slug is unique
      while (
        await prisma.forumThread.findFirst({ where: { slug: threadSlug } })
      ) {
        threadSlug = `${baseSlug}-${counter}`;
        counter += 1;
      }

      logger.info("Creating new thread", {
        userId: user.id,
        categoryId: category.id,
        title: validatedData.title,
        slug: threadSlug,
      });

      // Use transaction to create thread and first post
      const result = await prisma.$transaction(async (tx: any) => {
        // Create thread
        const thread = await tx.forumThread.create({
          data: {
            categoryId: category.id,
            title: validatedData.title,
            slug: threadSlug,
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
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        // Create first post
        const firstPost = await tx.forumPost.create({
          data: {
            threadId: thread.id,
            content: validatedData.content,
            isFirstPost: true,
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

        return { thread, firstPost };
      });

      // Format response to match Flask API
      const responseData = {
        id: result.thread.id,
        category_id: result.thread.categoryId,
        title: result.thread.title,
        slug: result.thread.slug,
        is_pinned: result.thread.isPinned,
        is_locked: result.thread.isLocked,
        report_count: result.thread.reportCount,
        created_by: result.thread.createdBy,
        created_date:
          result.thread.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          result.thread.updatedDate?.toISOString() ?? new Date().toISOString(),
        creator: {
          id: result.thread.creator.id,
          first_name: result.thread.creator.firstName,
          last_name: result.thread.creator.lastName,
        },
        category: {
          id: result.thread.category.id,
          name: result.thread.category.name,
          slug: result.thread.category.slug,
        },
        first_post: {
          id: result.firstPost.id,
          content: result.firstPost.content,
          created_date:
            result.firstPost.createdDate?.toISOString() ??
            new Date().toISOString(),
          creator: {
            id: result.firstPost.creator.id,
            first_name: result.firstPost.creator.firstName,
            last_name: result.firstPost.creator.lastName,
          },
        },
      };

      logger.info("Thread created successfully", {
        threadId: result.thread.id,
        userId: user.id,
        categoryId: category.id,
        firstPostId: result.firstPost.id,
      });

      return NextResponse.json(responseData, { status: 201 });
    } catch (error) {
      logger.error("Error creating thread", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: user.id,
        slug,
      });
      return NextResponse.json(
        { error: { message: "Internal server error", code: 500 } },
        { status: 500 }
      );
    }
  }
);
