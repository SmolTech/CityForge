import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedUser } from "@/lib/auth/middleware";
import {
  handleApiError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// Validation helper for reports
function validateReport(data: Record<string, unknown>) {
  const errors: string[] = [];

  const validReasons = ["spam", "inappropriate", "misleading", "other"];
  if (!data["reason"] || !validReasons.includes(data["reason"] as string)) {
    errors.push(
      "Reason must be one of: spam, inappropriate, misleading, other"
    );
  }

  if (data["details"] && typeof data["details"] !== "string") {
    errors.push("Details must be a string");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data:
      errors.length === 0
        ? {
            reason: data["reason"] as string,
            details:
              typeof data["details"] === "string"
                ? data["details"].trim()
                : null,
          }
        : null,
  };
}

// POST /api/help-wanted/[id]/report - Report a help wanted post
export const POST = withAuth(
  async (
    request: NextRequest,
    { user }: { user: AuthenticatedUser },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const postId = parseInt(id);

      if (isNaN(postId)) {
        throw new BadRequestError("Invalid post ID");
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
      const validation = validateReport(data);
      if (!validation.isValid) {
        throw new ValidationError("Validation failed", {
          errors: validation.errors,
        });
      }

      if (!validation.data) {
        throw new BadRequestError("Validation failed - no data");
      }

      // Check if post exists
      const post = await prisma.helpWantedPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });

      if (!post) {
        throw new NotFoundError("Help wanted post not found");
      }

      // Check if user has already reported this post
      const existingReport = await prisma.helpWantedReport.findFirst({
        where: {
          postId: postId,
          reportedBy: user.id,
        },
      });

      if (existingReport) {
        throw new BadRequestError("You have already reported this post");
      }

      // Create report
      const report = await prisma.helpWantedReport.create({
        data: {
          postId: postId,
          reason: validation.data.reason,
          details: validation.data.details,
          status: "pending",
          reportedBy: user.id,
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
          post: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Update post report count
      await prisma.helpWantedPost.update({
        where: { id: postId },
        data: {
          reportCount: {
            increment: 1,
          },
        },
      });

      // Transform data to match the expected API format
      const transformedReport = {
        id: report.id,
        post_id: report.postId,
        reason: report.reason,
        details: report.details,
        status: report.status,
        created_date: report.createdDate?.toISOString(),
        reviewed_date: report.reviewedDate?.toISOString(),
        reporter: report.reporter
          ? {
              id: report.reporter.id,
              first_name: report.reporter.firstName,
              last_name: report.reporter.lastName,
              email: report.reporter.email,
            }
          : undefined,
        post: report.post
          ? {
              id: report.post.id,
              title: report.post.title,
            }
          : undefined,
      };

      return NextResponse.json(transformedReport, { status: 201 });
    } catch (error: unknown) {
      return handleApiError(error, "POST /api/help-wanted/[id]/report");
    }
  }
);
