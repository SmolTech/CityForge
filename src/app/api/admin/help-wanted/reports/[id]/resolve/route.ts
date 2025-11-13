import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import {
  handleApiError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// Validation helper for report resolution
function validateReportResolution(data: Record<string, unknown>) {
  const errors: string[] = [];

  const validActions = ["dismiss", "delete_post"];
  if (!data.action || !validActions.includes(data.action)) {
    errors.push("Action must be one of: dismiss, delete_post");
  }

  if (data.notes && typeof data.notes !== "string") {
    errors.push("Notes must be a string");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data:
      errors.length === 0
        ? {
            action: data.action,
            notes: data.notes?.trim() || null,
          }
        : null,
  };
}

// POST /api/admin/help-wanted/reports/[id]/resolve - Resolve a help wanted report
export const POST = withAuth(
  async (
    request: NextRequest,
    { user }: { user: { id: number } },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const reportId = parseInt(id);

      if (isNaN(reportId)) {
        throw new BadRequestError("Invalid report ID");
      }

      // Parse request body
      let data;
      try {
        data = await request.json();
      } catch {
        throw new BadRequestError("No data provided");
      }

      if (!data) {
        throw new BadRequestError("No data provided");
      }

      // Validate input data
      const validation = validateReportResolution(data);
      if (!validation.isValid) {
        throw new ValidationError("Validation failed", {
          errors: validation.errors,
        });
      }

      if (!validation.data) {
        throw new BadRequestError("Validation failed - no data");
      }

      // Check if report exists
      const existingReport = await prisma.helpWantedReport.findUnique({
        where: { id: reportId },
        include: {
          post: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!existingReport) {
        throw new NotFoundError("Report not found");
      }

      if (existingReport.status === "resolved") {
        throw new BadRequestError("Report has already been resolved");
      }

      // Start transaction to handle report resolution and potential post deletion
      const result = await prisma.$transaction(async (tx) => {
        // Update the report
        const updatedReport = await tx.helpWantedReport.update({
          where: { id: reportId },
          data: {
            status: "resolved",
            reviewedBy: user.id,
            reviewedDate: new Date(),
            resolutionNotes: validation.data!.notes,
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
            post: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });

        // If action is delete_post, delete the post
        if (validation.data!.action === "delete_post") {
          await tx.helpWantedPost.delete({
            where: { id: existingReport.postId },
          });
        }

        return updatedReport;
      });

      // Transform data to match the expected API format
      const transformedReport = {
        id: result.id,
        post_id: result.postId,
        reason: result.reason,
        details: result.details,
        status: result.status,
        created_date: result.createdDate?.toISOString(),
        reviewed_date: result.reviewedDate?.toISOString(),
        resolution_notes: result.resolutionNotes,
        reporter: result.reporter
          ? {
              id: result.reporter.id,
              first_name: result.reporter.firstName,
              last_name: result.reporter.lastName,
              email: result.reporter.email,
            }
          : undefined,
        reviewer: result.reviewer
          ? {
              id: result.reviewer.id,
              first_name: result.reviewer.firstName,
              last_name: result.reviewer.lastName,
              email: result.reviewer.email,
            }
          : undefined,
        post: result.post
          ? {
              id: result.post.id,
              title: result.post.title,
            }
          : undefined,
      };

      return NextResponse.json({
        message: `Report resolved with action: ${validation.data.action}`,
        report: transformedReport,
      });
    } catch (error) {
      return handleApiError(
        error,
        "POST /api/admin/help-wanted/reports/[id]/resolve"
      );
    }
  },
  { requireAdmin: true }
);
