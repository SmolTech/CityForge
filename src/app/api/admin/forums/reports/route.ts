import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") || "pending";
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      // Build where clause conditionally
      const whereClause = status === "all" ? {} : { status };

      logger.info("Admin fetching forum reports", {
        status,
        limit,
        offset,
      });

      const reports = await prisma.forumReport.findMany({
        where: whereClause,
        include: {
          reporter: {
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
          thread: {
            select: {
              id: true,
              title: true,
              slug: true,
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
                },
              },
            },
          },
          post: {
            select: {
              id: true,
              content: true,
              creator: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdDate: "desc",
        },
        skip: offset,
        take: limit,
      });

      const total = await prisma.forumReport.count({
        where: whereClause,
      });

      // Transform to match expected response format
      const transformedReports = reports.map((report) => ({
        id: report.id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        thread_id: report.threadId,
        post_id: report.postId,
        created_date:
          report.createdDate?.toISOString() ?? new Date().toISOString(),
        reviewed_date: report.reviewedDate?.toISOString() ?? null,
        resolution_notes: report.resolutionNotes,
        reporter: report.reporter
          ? {
              id: report.reporter.id,
              first_name: report.reporter.firstName,
              last_name: report.reporter.lastName,
              email: report.reporter.email,
            }
          : null,
        reviewer: report.reviewer
          ? {
              id: report.reviewer.id,
              first_name: report.reviewer.firstName,
              last_name: report.reviewer.lastName,
              email: report.reviewer.email,
            }
          : null,
        thread: report.thread
          ? {
              id: report.thread.id,
              title: report.thread.title,
              slug: report.thread.slug,
              category: report.thread.category
                ? {
                    id: report.thread.category.id,
                    name: report.thread.category.name,
                    slug: report.thread.category.slug,
                  }
                : null,
              creator: report.thread.creator
                ? {
                    id: report.thread.creator.id,
                    first_name: report.thread.creator.firstName,
                    last_name: report.thread.creator.lastName,
                  }
                : null,
            }
          : null,
        post: report.post
          ? {
              id: report.post.id,
              content: report.post.content.substring(0, 200) + "...", // Truncate for admin list
              creator: report.post.creator
                ? {
                    id: report.post.creator.id,
                    first_name: report.post.creator.firstName,
                    last_name: report.post.creator.lastName,
                  }
                : null,
            }
          : null,
      }));

      logger.info("Successfully fetched admin forum reports", {
        count: transformedReports.length,
        total,
      });

      return NextResponse.json({
        reports: transformedReports,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    } catch (error) {
      logger.error("Error fetching forum reports", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch forum reports",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
