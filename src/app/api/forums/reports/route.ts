import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { validateForumReport } from "@/lib/validation/forums";
import { logger } from "@/lib/logger";
import { sendForumReportNotification } from "@/lib/email";

/**
 * POST /api/forums/reports
 * Report a thread or post for moderation review
 */
export const POST = withCsrfProtection(
  withAuth(async (request: NextRequest, { user }) => {
    try {
      const body = await request.json();

      // Validate the report data
      const validation = validateForumReport(body);

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

      const reportData = validation.data!;

      // Validate required fields for report - either thread_id or post_id must be provided
      if (
        (!body.thread_id || typeof body.thread_id !== "number") &&
        (!body.post_id || typeof body.post_id !== "number")
      ) {
        return NextResponse.json(
          {
            error: {
              message: "Either thread_id or post_id is required",
              code: 422,
            },
          },
          { status: 422 }
        );
      }

      let threadId = body.thread_id;
      const postId =
        body.post_id && typeof body.post_id === "number" ? body.post_id : null;

      // If only post_id is provided, look up the thread_id
      if (!threadId && postId) {
        const post = await prisma.forumPost.findFirst({
          where: { id: postId },
          select: { threadId: true },
        });

        if (!post) {
          return NextResponse.json(
            { error: { message: "Post not found", code: 404 } },
            { status: 404 }
          );
        }

        threadId = post.threadId;
      }

      logger.info(`Creating forum report`, {
        userId: user.id,
        threadId,
        postId,
        reason: reportData.reason,
      });

      // Verify thread exists and is accessible
      const thread = await prisma.forumThread.findFirst({
        where: {
          id: threadId,
          category: {
            isActive: true,
          },
        },
        select: {
          id: true,
          title: true,
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!thread) {
        return NextResponse.json(
          { error: { message: "Thread not found", code: 404 } },
          { status: 404 }
        );
      }

      // If reporting a post, verify it exists and belongs to the thread
      if (postId) {
        const post = await prisma.forumPost.findFirst({
          where: {
            id: postId,
            threadId: threadId,
          },
          select: {
            id: true,
          },
        });

        if (!post) {
          return NextResponse.json(
            { error: { message: "Post not found in this thread", code: 404 } },
            { status: 404 }
          );
        }
      }

      // Check for duplicate report from the same user
      const existingReport = await prisma.forumReport.findFirst({
        where: {
          threadId: threadId,
          postId: postId,
          reportedBy: user.id,
        },
        select: { id: true },
      });

      if (existingReport) {
        return NextResponse.json(
          {
            error: {
              message: "You have already reported this content",
              code: 409,
            },
          },
          { status: 409 }
        );
      }

      // Create the report and increment report count in a transaction
      const report = await prisma.$transaction(async (tx) => {
        // Create the report
        const newReport = await tx.forumReport.create({
          data: {
            threadId: threadId,
            postId: postId,
            reason: reportData.reason,
            details: reportData.details || null,
            reportedBy: user.id,
            status: "pending",
          },
          include: {
            reporter: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            thread: {
              select: {
                id: true,
                title: true,
                slug: true,
                categoryId: true,
              },
            },
            post: postId
              ? {
                  select: {
                    id: true,
                    content: true,
                  },
                }
              : false,
          },
        });

        // Increment the appropriate report count
        if (postId) {
          // Report is for a specific post
          await tx.forumPost.update({
            where: { id: postId },
            data: {
              reportCount: {
                increment: 1,
              },
            },
          });
        } else {
          // Report is for the entire thread
          await tx.forumThread.update({
            where: { id: threadId },
            data: {
              reportCount: {
                increment: 1,
              },
            },
          });
        }

        return newReport;
      });

      logger.info("Successfully created forum report", {
        reportId: report.id,
        threadId: report.threadId,
        postId: report.postId,
        userId: user.id,
        reason: report.reason,
      });

      // Send email notification to admins
      try {
        // Get the category information that we need for the email
        const thread = await prisma.forumThread.findUnique({
          where: { id: report.threadId },
          include: {
            category: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        });

        if (thread) {
          const reportData = {
            id: report.id,
            thread: {
              id: report.thread.id,
              title: report.thread.title,
              slug: report.thread.slug,
              categoryId: report.thread.categoryId,
              category: {
                name: thread.category.name,
                slug: thread.category.slug,
              },
            },
            post: report.post
              ? {
                  id: report.post.id,
                  content: report.post.content,
                }
              : null,
            reason: report.reason,
            details: report.details,
            created_date:
              report.createdDate?.toISOString() ?? new Date().toISOString(),
          };

          const reporter = {
            id: report.reporter.id,
            firstName: report.reporter.firstName,
            lastName: report.reporter.lastName,
            email: user.email, // Use the authenticated user's email
          };

          await sendForumReportNotification(reportData, reporter);
          logger.info("Forum report notification email sent", {
            reportId: report.id,
            threadId: report.threadId,
            postId: report.postId,
          });
        }
      } catch (emailError) {
        // Log email error but don't fail the report creation
        logger.error("Failed to send forum report notification email", {
          reportId: report.id,
          threadId: report.threadId,
          postId: report.postId,
          error:
            emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }

      // Transform response to match Flask API format
      const responseData = {
        id: report.id,
        thread_id: report.threadId,
        post_id: report.postId,
        reason: report.reason,
        details: report.details,
        status: report.status,
        reported_by: report.reportedBy,
        reviewed_by: report.reviewedBy,
        created_date:
          report.createdDate?.toISOString() ?? new Date().toISOString(),
        reviewed_date: report.reviewedDate?.toISOString() || null,
        resolution_notes: report.resolutionNotes,
        reporter: {
          id: report.reporter.id,
          first_name: report.reporter.firstName,
          last_name: report.reporter.lastName,
        },
        thread: {
          id: report.thread.id,
          title: report.thread.title,
          slug: report.thread.slug,
          category_id: report.thread.categoryId,
        },
        post: report.post
          ? {
              id: report.post.id,
              content: report.post.content,
            }
          : null,
      };

      return NextResponse.json({ report: responseData }, { status: 201 });
    } catch (error) {
      logger.error("Error creating forum report", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: user.id,
      });
      return NextResponse.json(
        { error: { message: "Internal server error", code: 500 } },
        { status: 500 }
      );
    }
  })
);

/**
 * GET /api/forums/reports
 * Get user's own reports (for tracking purposes)
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    logger.info(`Getting user's forum reports`, {
      userId: user.id,
      page,
      limit,
    });

    // Get user's reports
    const reports = await prisma.forumReport.findMany({
      where: {
        reportedBy: user.id,
      },
      include: {
        thread: {
          select: {
            id: true,
            title: true,
            slug: true,
            categoryId: true,
            category: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        post: {
          select: {
            id: true,
            content: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdDate: "desc",
      },
      skip: offset,
      take: limit,
    });

    // Get total count for pagination
    const totalReports = await prisma.forumReport.count({
      where: {
        reportedBy: user.id,
      },
    });

    const totalPages = Math.ceil(totalReports / limit);

    // Transform reports to match Flask API format
    const transformedReports = reports.map((report) => ({
      id: report.id,
      thread_id: report.threadId,
      post_id: report.postId,
      reason: report.reason,
      details: report.details,
      status: report.status,
      reported_by: report.reportedBy,
      reviewed_by: report.reviewedBy,
      created_date:
        report.createdDate?.toISOString() ?? new Date().toISOString(),
      reviewed_date: report.reviewedDate?.toISOString() || null,
      resolution_notes: report.resolutionNotes,
      thread: {
        id: report.thread.id,
        title: report.thread.title,
        slug: report.thread.slug,
        category_id: report.thread.categoryId,
        category: {
          name: report.thread.category.name,
          slug: report.thread.category.slug,
        },
      },
      post: report.post
        ? {
            id: report.post.id,
            content:
              report.post.content.substring(0, 100) +
              (report.post.content.length > 100 ? "..." : ""), // Truncate for list view
          }
        : null,
      reviewer: report.reviewer
        ? {
            id: report.reviewer.id,
            first_name: report.reviewer.firstName,
            last_name: report.reviewer.lastName,
          }
        : null,
    }));

    logger.info("Successfully fetched user's forum reports", {
      userId: user.id,
      reportCount: transformedReports.length,
      totalReports,
      page,
    });

    const responseData = {
      reports: transformedReports,
      pagination: {
        page,
        limit,
        total: totalReports,
        total_pages: totalPages,
      },
    };

    const response = NextResponse.json(responseData);

    // Cache for 1 minute (user's own data, but may change with moderation actions)
    response.headers.set("Cache-Control", "private, max-age=60");

    return response;
  } catch (error) {
    logger.error("Error fetching user's forum reports", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: user.id,
    });
    return NextResponse.json(
      { error: { message: "Internal server error", code: 500 } },
      { status: 500 }
    );
  }
});
