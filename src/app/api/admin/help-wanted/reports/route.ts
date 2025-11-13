import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// GET /api/admin/help-wanted/reports - Get help wanted reports for admin
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") || "pending";
      const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
      const offset = parseInt(searchParams.get("offset") || "0");

      const where: Record<string, unknown> = {
        status,
      };

      const [reports, totalCount] = await Promise.all([
        prisma.helpWantedReport.findMany({
          where,
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
                description: true,
                category: true,
                status: true,
                creator: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdDate: "desc",
          },
          take: limit,
          skip: offset,
        }),
        prisma.helpWantedReport.count({ where }),
      ]);

      // Transform data to match the expected API format
      const transformedReports = reports.map((report) => ({
        id: report.id,
        post_id: report.postId,
        reason: report.reason,
        details: report.details,
        status: report.status,
        created_date: report.createdDate?.toISOString(),
        reviewed_date: report.reviewedDate?.toISOString(),
        resolution_notes: report.resolutionNotes,
        reporter: report.reporter
          ? {
              id: report.reporter.id,
              first_name: report.reporter.firstName,
              last_name: report.reporter.lastName,
              email: report.reporter.email,
            }
          : undefined,
        reviewer: report.reviewer
          ? {
              id: report.reviewer.id,
              first_name: report.reviewer.firstName,
              last_name: report.reviewer.lastName,
              email: report.reviewer.email,
            }
          : undefined,
        post: report.post
          ? {
              id: report.post.id,
              title: report.post.title,
              description: report.post.description,
              category: report.post.category,
              status: report.post.status,
              creator: report.post.creator
                ? {
                    id: report.post.creator.id,
                    first_name: report.post.creator.firstName,
                    last_name: report.post.creator.lastName,
                    email: report.post.creator.email,
                  }
                : undefined,
            }
          : undefined,
      }));

      return NextResponse.json({
        reports: transformedReports,
        total: totalCount,
        offset,
        limit,
      });
    } catch (error) {
      return handleApiError(error, "GET /api/admin/help-wanted/reports");
    }
  },
  { requireAdmin: true }
);
