import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/forums/category-requests/[id]/reject - Reject a forum category request
 */
export const POST = withAuth(
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const resolvedParams = await params;
      const requestId = parseInt(resolvedParams.id);
      const body = await request.json();
      const { notes } = body;

      logger.info("Admin rejecting category request", {
        requestId,
        reviewedBy: user.id,
        notes,
      });

      // Get the request to verify it exists and is pending
      const categoryRequest = await prisma.forumCategoryRequest.findUnique({
        where: { id: requestId },
        include: {
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!categoryRequest) {
        return NextResponse.json(
          {
            error: {
              message: "Category request not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      if (categoryRequest.status !== "pending") {
        return NextResponse.json(
          {
            error: {
              message: "Category request is not pending approval",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Update the request status to rejected
      const updatedRequest = await prisma.forumCategoryRequest.update({
        where: { id: requestId },
        data: {
          status: "rejected",
          reviewedBy: user.id,
          reviewedDate: new Date(),
          reviewNotes: notes || null,
        },
        include: {
          requester: {
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
      });

      // Transform response to match expected format
      const transformedRequest = {
        id: updatedRequest.id,
        name: updatedRequest.name,
        description: updatedRequest.description,
        justification: updatedRequest.justification,
        status: updatedRequest.status,
        created_date:
          updatedRequest.createdDate?.toISOString() ?? new Date().toISOString(),
        reviewed_date: updatedRequest.reviewedDate?.toISOString() ?? null,
        review_notes: updatedRequest.reviewNotes,
        requester: updatedRequest.requester
          ? {
              id: updatedRequest.requester.id,
              first_name: updatedRequest.requester.firstName,
              last_name: updatedRequest.requester.lastName,
              email: updatedRequest.requester.email,
            }
          : null,
        reviewer: updatedRequest.reviewer
          ? {
              id: updatedRequest.reviewer.id,
              first_name: updatedRequest.reviewer.firstName,
              last_name: updatedRequest.reviewer.lastName,
              email: updatedRequest.reviewer.email,
            }
          : null,
      };

      logger.info("Successfully rejected category request", {
        requestId,
        requestName: updatedRequest.name,
      });

      return NextResponse.json({
        message: "Category request rejected successfully",
        request: transformedRequest,
      });
    } catch (error) {
      const resolvedParams = await params;
      logger.error("Error rejecting category request", {
        requestId: resolvedParams.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          error: {
            message: "Failed to reject category request",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
