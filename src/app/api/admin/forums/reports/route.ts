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

      logger.info("Admin fetching aggregated forum reports", {
        status,
        limit,
        offset,
      });

      // For the aggregated approach, we fetch threads and posts with reportCount > 0
      const [reportedThreads, reportedPosts] = await Promise.all([
        // Get reported threads
        prisma.forumThread.findMany({
          where: {
            reportCount: { gt: 0 },
          },
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
              },
            },
            // Get the most recent report for this thread for context
            reports: {
              where: { status: "pending" },
              include: {
                reporter: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
              orderBy: { createdDate: "desc" },
              take: 1,
            },
          },
          orderBy: { reportCount: "desc" }, // Show most reported items first
        }),

        // Get reported posts
        prisma.forumPost.findMany({
          where: {
            reportCount: { gt: 0 },
          },
          include: {
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
              },
            },
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            // Get the most recent report for this post for context
            reports: {
              where: { status: "pending" },
              include: {
                reporter: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
              orderBy: { createdDate: "desc" },
              take: 1,
            },
          },
          orderBy: { reportCount: "desc" }, // Show most reported items first
        }),
      ]);

      // Transform threads to the expected format
      const transformedThreads = reportedThreads
        .filter((thread) => {
          // Apply status filter
          if (status === "pending") return thread.reports.length > 0;
          if (status === "all") return true;
          return false;
        })
        .map((thread) => ({
          type: "thread",
          thread_id: thread.id,
          post_id: null,
          reportCount: thread.reportCount,
          content_type: "thread",
          status: thread.reports.length > 0 ? "pending" : "resolved",
          thread: {
            id: thread.id,
            title: thread.title,
            slug: thread.slug,
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
                }
              : null,
          },
          post: null,
          // Use most recent report for context
          most_recent_report: thread.reports[0]
            ? {
                id: thread.reports[0].id,
                reason: thread.reports[0].reason,
                details: thread.reports[0].details,
                created_date:
                  thread.reports[0].createdDate?.toISOString() ??
                  new Date().toISOString(),
                reporter: thread.reports[0].reporter
                  ? {
                      id: thread.reports[0].reporter.id,
                      first_name: thread.reports[0].reporter.firstName,
                      last_name: thread.reports[0].reporter.lastName,
                      email: thread.reports[0].reporter.email,
                    }
                  : null,
              }
            : null,
        }));

      // Transform posts to the expected format
      const transformedPosts = reportedPosts
        .filter((post) => {
          // Apply status filter
          if (status === "pending") return post.reports.length > 0;
          if (status === "all") return true;
          return false;
        })
        .map((post) => ({
          type: "post",
          thread_id: post.threadId,
          post_id: post.id,
          reportCount: post.reportCount,
          content_type: "post",
          status: post.reports.length > 0 ? "pending" : "resolved",
          thread: post.thread
            ? {
                id: post.thread.id,
                title: post.thread.title,
                slug: post.thread.slug,
                category: post.thread.category
                  ? {
                      id: post.thread.category.id,
                      name: post.thread.category.name,
                      slug: post.thread.category.slug,
                    }
                  : null,
              }
            : null,
          post: {
            id: post.id,
            content: post.content.substring(0, 200) + "...", // Truncate for admin list
            creator: post.creator
              ? {
                  id: post.creator.id,
                  first_name: post.creator.firstName,
                  last_name: post.creator.lastName,
                }
              : null,
          },
          // Use most recent report for context
          most_recent_report: post.reports[0]
            ? {
                id: post.reports[0].id,
                reason: post.reports[0].reason,
                details: post.reports[0].details,
                created_date:
                  post.reports[0].createdDate?.toISOString() ??
                  new Date().toISOString(),
                reporter: post.reports[0].reporter
                  ? {
                      id: post.reports[0].reporter.id,
                      first_name: post.reports[0].reporter.firstName,
                      last_name: post.reports[0].reporter.lastName,
                      email: post.reports[0].reporter.email,
                    }
                  : null,
              }
            : null,
        }));

      // Combine and sort by report count (descending)
      const allReports = [...transformedThreads, ...transformedPosts].sort(
        (a, b) => b.reportCount - a.reportCount
      );

      // Apply pagination
      const paginatedReports = allReports.slice(offset, offset + limit);
      const total = allReports.length;

      logger.info("Successfully fetched aggregated admin forum reports", {
        threadsFound: reportedThreads.length,
        postsFound: reportedPosts.length,
        totalAggregated: allReports.length,
        returned: paginatedReports.length,
      });

      return NextResponse.json({
        reports: paginatedReports,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    } catch (error) {
      logger.error("Error fetching aggregated forum reports", {
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
