import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const categoryId = searchParams.get("category_id");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      // Build where clause conditionally
      const whereClause: any = {};
      if (categoryId) {
        whereClause.categoryId = parseInt(categoryId);
      }

      logger.info("Admin fetching forum threads", {
        categoryId,
        limit,
        offset,
      });

      const threads = await prisma.forumThread.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              posts: true,
              reports: true,
            },
          },
        },
        orderBy: [
          { isPinned: "desc" }, // Pinned threads first
          { updatedDate: "desc" },
        ],
        skip: offset,
        take: limit,
      });

      const total = await prisma.forumThread.count({
        where: whereClause,
      });

      // Transform to match expected response format
      const transformedThreads = threads.map((thread: any) => ({
        id: thread.id,
        title: thread.title,
        slug: thread.slug,
        is_pinned: thread.isPinned,
        is_locked: thread.isLocked,
        created_date:
          thread.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          thread.updatedDate?.toISOString() ?? new Date().toISOString(),
        category: thread.category
          ? {
              id: thread.category.id,
              name: thread.category.name,
              slug: thread.category.slug,
            }
          : null,
        creator: thread.creator
          ? {
              id: thread.creator.id,
              first_name: thread.creator.firstName,
              last_name: thread.creator.lastName,
              email: thread.creator.email,
            }
          : null,
        post_count: thread._count.posts,
        report_count: thread._count.reports,
      }));

      logger.info("Successfully fetched admin forum threads", {
        count: transformedThreads.length,
        total,
      });

      return NextResponse.json({
        threads: transformedThreads,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    } catch (error) {
      logger.error("Error fetching admin forum threads", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch forum threads",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
