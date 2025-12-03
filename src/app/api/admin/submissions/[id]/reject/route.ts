import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";

export const POST = withCsrfProtection(
  withAuth(
    async (
      request: NextRequest,
      { user },
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const { id } = await params;
        const submissionId = parseInt(id);

        if (isNaN(submissionId)) {
          return NextResponse.json(
            { error: { message: "Invalid submission ID" } },
            { status: 400 }
          );
        }

        const body = await request.json();
        const { notes = "" } = body;

        // Find the submission
        const submission = await prisma.cardSubmission.findUnique({
          where: { id: submissionId },
        });

        if (!submission) {
          return NextResponse.json(
            { error: { message: "Submission not found" } },
            { status: 404 }
          );
        }

        if (submission.status === "approved") {
          return NextResponse.json(
            { error: { message: "Cannot reject an approved submission" } },
            { status: 400 }
          );
        }

        if (submission.status === "rejected") {
          return NextResponse.json(
            { error: { message: "Submission already rejected" } },
            { status: 400 }
          );
        }

        // Update the submission
        const updatedSubmission = await prisma.cardSubmission.update({
          where: { id: submissionId },
          data: {
            status: "rejected",
            reviewedBy: user.id,
            reviewedDate: new Date(),
            reviewNotes: notes,
          },
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
        });

        // Transform submission to API format
        const transformedSubmission = {
          id: updatedSubmission.id,
          name: updatedSubmission.name,
          description: updatedSubmission.description,
          website_url: updatedSubmission.websiteUrl,
          phone_number: updatedSubmission.phoneNumber,
          email: updatedSubmission.email,
          address: updatedSubmission.address,
          address_override_url: updatedSubmission.addressOverrideUrl,
          contact_name: updatedSubmission.contactName,
          image_url: updatedSubmission.imageUrl,
          tags_text: updatedSubmission.tagsText,
          status: updatedSubmission.status,
          review_notes: updatedSubmission.reviewNotes,
          created_date: updatedSubmission.createdDate?.toISOString(),
          submitted_by: updatedSubmission.submittedBy,
          submitter: updatedSubmission.submitter
            ? {
                id: updatedSubmission.submitter.id,
                first_name: updatedSubmission.submitter.firstName,
                last_name: updatedSubmission.submitter.lastName,
                email: updatedSubmission.submitter.email,
              }
            : null,
          reviewed_by: updatedSubmission.reviewedBy,
          reviewer: updatedSubmission.reviewer
            ? {
                id: updatedSubmission.reviewer.id,
                first_name: updatedSubmission.reviewer.firstName,
                last_name: updatedSubmission.reviewer.lastName,
                email: updatedSubmission.reviewer.email,
              }
            : null,
          reviewed_date: updatedSubmission.reviewedDate?.toISOString(),
          card_id: updatedSubmission.cardId,
        };

        return NextResponse.json({
          message: "Submission rejected successfully",
          submission: transformedSubmission,
        });
      } catch (error) {
        return handleApiError(error);
      }
    },
    { requireAdmin: true }
  )
);
