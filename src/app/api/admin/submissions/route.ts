import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);

      // Build where clause
      const where: {
        status?: string;
      } = {};

      if (status && status !== "all") {
        where.status = status;
      }

      // Get submissions with user info
      const [submissions, total] = await Promise.all([
        prisma.cardSubmission.findMany({
          where,
          include: {
            submitter: {
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
          },
          orderBy: { createdDate: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.cardSubmission.count({ where }),
      ]);

      // Transform to match API format
      const transformedSubmissions = submissions.map(
        (submission: {
          id: number;
          name: string;
          description: string | null;
          websiteUrl: string | null;
          phoneNumber: string | null;
          email: string | null;
          address: string | null;
          addressOverrideUrl: string | null;
          contactName: string | null;
          imageUrl: string | null;
          status: string | null;
          reviewNotes: string | null;
          createdDate: Date | null;
          submittedBy: number | null;
          reviewedBy: number | null;
          reviewedDate: Date | null;
          submitter: {
            id: number;
            firstName: string | null;
            lastName: string | null;
            email: string;
          } | null;
          reviewer: {
            id: number;
            firstName: string | null;
            lastName: string | null;
            email: string;
          } | null;
        }) => ({
          id: submission.id,
          name: submission.name,
          description: submission.description,
          website_url: submission.websiteUrl,
          phone_number: submission.phoneNumber,
          email: submission.email,
          address: submission.address,
          address_override_url: submission.addressOverrideUrl,
          contact_name: submission.contactName,
          image_url: submission.imageUrl,
          status: submission.status,
          review_notes: submission.reviewNotes,
          created_date: submission.createdDate?.toISOString(),
          submitted_by: submission.submittedBy,
          submitter: submission.submitter
            ? {
                id: submission.submitter.id,
                first_name: submission.submitter.firstName,
                last_name: submission.submitter.lastName,
                email: submission.submitter.email,
              }
            : null,
          reviewed_by: submission.reviewedBy,
          reviewer: submission.reviewer
            ? {
                id: submission.reviewer.id,
                first_name: submission.reviewer.firstName,
                last_name: submission.reviewer.lastName,
                email: submission.reviewer.email,
              }
            : null,
          reviewed_date: submission.reviewedDate?.toISOString(),
        })
      );

      return NextResponse.json({
        submissions: transformedSubmissions,
        total,
        limit,
        offset,
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);
