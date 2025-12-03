import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/forums/reports/[id]/resolve - Resolve a forum report
 */
export const POST = withCsrfProtection(
  withAuth(
    async (
      request: NextRequest,
      { user },
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const resolvedParams = await params;
        const reportId = parseInt(resolvedParams.id);
        const body = await request.json();
        const { action, notes } = body;

        // Validate action
        const validActions = ["dismiss", "delete_post", "delete_thread"];
        if (!validActions.includes(action)) {
          return NextResponse.json(
            {
              error: {
                message:
                  "Invalid action. Must be one of: dismiss, delete_post, delete_thread",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        logger.info("Admin resolving forum report", {
          reportId,
          action,
          notes,
          reviewedBy: user.id,
        });

        // Get the report to verify it exists and is pending
        const report = await prisma.forumReport.findUnique({
          where: { id: reportId },
          include: {
            thread: true,
            post: true,
          },
        });

        if (!report) {
          return NextResponse.json(
            {
              error: {
                message: "Report not found",
                code: 404,
              },
            },
            { status: 404 }
          );
        }

        if (report.status !== "pending") {
          return NextResponse.json(
            {
              error: {
                message: "Report is not pending resolution",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        // Perform the action in a transaction
        const result = await prisma.$transaction(async (tx) => {
          // Update the report status
          const updatedReport = await tx.forumReport.update({
            where: { id: reportId },
            data: {
              status: "resolved",
              reviewedBy: user.id,
              reviewedDate: new Date(),
              resolutionNotes: notes || null,
            },
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
          });

          // Perform the requested action
          if (action === "delete_post" && report.postId) {
            // First delete any other reports that reference this post (to avoid FK constraint violations)
            await tx.forumReport.deleteMany({
              where: {
                postId: report.postId,
                id: { not: reportId }, // Don't delete the current report, it's already updated
              },
            });

            // Now delete the specific post
            await tx.forumPost.delete({
              where: { id: report.postId },
            });
          } else if (action === "delete_thread") {
            // First delete any other reports that reference this thread or its posts (to avoid FK constraint violations)
            await tx.forumReport.deleteMany({
              where: {
                threadId: report.threadId,
                id: { not: reportId }, // Don't delete the current report, it's already updated
              },
            });

            // Delete all posts in the thread first, then the thread
            await tx.forumPost.deleteMany({
              where: { threadId: report.threadId },
            });
            await tx.forumThread.delete({
              where: { id: report.threadId },
            });
          }
          // For "dismiss", we just update the report status (already done above)

          return updatedReport;
        });

        // Transform response to match expected format
        const transformedReport = {
          id: result.id,
          reason: result.reason,
          details: result.details,
          status: result.status,
          created_date:
            result.createdDate?.toISOString() ?? new Date().toISOString(),
          reviewed_date: result.reviewedDate?.toISOString() ?? null,
          resolution_notes: result.resolutionNotes,
          reporter: result.reporter
            ? {
                id: result.reporter.id,
                first_name: result.reporter.firstName,
                last_name: result.reporter.lastName,
                email: result.reporter.email,
              }
            : null,
          reviewer: result.reviewer
            ? {
                id: result.reviewer.id,
                first_name: result.reviewer.firstName,
                last_name: result.reviewer.lastName,
                email: result.reviewer.email,
              }
            : null,
          thread: result.thread
            ? {
                id: result.thread.id,
                title: result.thread.title,
                slug: result.thread.slug,
                category: result.thread.category
                  ? {
                      id: result.thread.category.id,
                      name: result.thread.category.name,
                      slug: result.thread.category.slug,
                    }
                  : null,
              }
            : null,
          post: result.post
            ? {
                id: result.post.id,
                content: result.post.content,
                creator: result.post.creator
                  ? {
                      id: result.post.creator.id,
                      first_name: result.post.creator.firstName,
                      last_name: result.post.creator.lastName,
                    }
                  : null,
              }
            : null,
        };

        let message = "Report resolved successfully";
        if (action === "delete_post") {
          message = "Report resolved and post deleted";
        } else if (action === "delete_thread") {
          message = "Report resolved and thread deleted";
        } else if (action === "dismiss") {
          message = "Report dismissed";
        }

        logger.info("Successfully resolved forum report", {
          reportId,
          action,
          reportReason: result.reason,
        });

        return NextResponse.json({
          message,
          report: transformedReport,
        });
      } catch (error) {
        const resolvedParams = await params;
        logger.error("Error resolving forum report", {
          reportId: resolvedParams.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
          {
            error: {
              message: "Failed to resolve forum report",
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
