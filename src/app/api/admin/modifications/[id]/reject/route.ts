import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";

export const POST = withCsrfProtection(
  withAuth(
    async (
      request: NextRequest,
      context,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const { id } = await params;
        const modificationId = parseInt(id, 10);

        if (isNaN(modificationId)) {
          return NextResponse.json(
            { error: "Invalid modification ID" },
            { status: 400 }
          );
        }

        // Parse the request body to get optional review notes
        const body = await request.json().catch(() => ({}));
        const notes = body.notes || "";

        // Get the modification
        const modification = await prisma.cardModification.findUnique({
          where: { id: modificationId },
          include: {
            card: {
              select: {
                id: true,
                name: true,
              },
            },
            submitter: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        if (!modification) {
          return NextResponse.json(
            { error: "Modification not found" },
            { status: 404 }
          );
        }

        if (modification.status !== "pending") {
          return NextResponse.json(
            { error: "Modification has already been reviewed" },
            { status: 400 }
          );
        }

        // Get the current user from context
        const user = context.user;
        if (!user) {
          return NextResponse.json(
            { error: "User not found in request context" },
            { status: 401 }
          );
        }

        // Update the modification status
        const updatedModification = await prisma.cardModification.update({
          where: { id: modificationId },
          data: {
            status: "rejected",
            reviewedBy: user.id,
            reviewedDate: new Date(),
            reviewNotes: notes,
          },
          include: {
            card: {
              select: {
                id: true,
                name: true,
              },
            },
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
        });

        // Transform the response to match the expected format
        const transformedModification = {
          id: updatedModification.id,
          card_id: updatedModification.cardId,
          card: updatedModification.card
            ? {
                id: updatedModification.card.id,
                name: updatedModification.card.name,
              }
            : null,
          name: updatedModification.name,
          description: updatedModification.description,
          website_url: updatedModification.websiteUrl,
          phone_number: updatedModification.phoneNumber,
          email: updatedModification.email,
          address: updatedModification.address,
          address_override_url: updatedModification.addressOverrideUrl,
          contact_name: updatedModification.contactName,
          image_url: updatedModification.imageUrl,
          status: updatedModification.status,
          review_notes: updatedModification.reviewNotes,
          created_date: updatedModification.createdDate?.toISOString(),
          submitted_by: updatedModification.submittedBy,
          submitter: updatedModification.submitter
            ? {
                id: updatedModification.submitter.id,
                first_name: updatedModification.submitter.firstName,
                last_name: updatedModification.submitter.lastName,
                email: updatedModification.submitter.email,
              }
            : null,
          reviewed_by: updatedModification.reviewedBy,
          reviewer: updatedModification.reviewer
            ? {
                id: updatedModification.reviewer.id,
                first_name: updatedModification.reviewer.firstName,
                last_name: updatedModification.reviewer.lastName,
                email: updatedModification.reviewer.email,
              }
            : null,
          reviewed_date: updatedModification.reviewedDate?.toISOString(),
        };

        return NextResponse.json({
          message: "Modification rejected successfully",
          modification: transformedModification,
        });
      } catch (error) {
        return handleApiError(error);
      }
    },
    { requireAdmin: true }
  )
);
