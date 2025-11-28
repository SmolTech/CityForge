import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";

export const POST = withAuth(
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
      const { featured = false, notes = "" } = body;

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
          { error: { message: "Submission already approved" } },
          { status: 400 }
        );
      }

      // Parse tags from tagsText
      let tagIds: number[] = [];
      if (submission.tagsText) {
        const tagNames = submission.tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);

        // Find or create tags sequentially to avoid race conditions
        const tags = [];
        for (const name of tagNames) {
          try {
            const tag = await prisma.tag.upsert({
              where: { name },
              create: { name },
              update: {},
            });
            tags.push(tag);
          } catch (error: any) {
            // If upsert fails due to race condition, try to find existing tag
            if (error.code === "P2002") {
              const existingTag = await prisma.tag.findUnique({
                where: { name },
              });
              if (existingTag) {
                tags.push(existingTag);
              } else {
                throw error; // Re-throw if it's a different error
              }
            } else {
              throw error;
            }
          }
        }

        tagIds = tags.map((tag) => tag.id);
      }

      // Create the card
      const card = await prisma.card.create({
        data: {
          name: submission.name,
          description: submission.description,
          websiteUrl: submission.websiteUrl,
          phoneNumber: submission.phoneNumber,
          email: submission.email,
          address: submission.address,
          addressOverrideUrl: submission.addressOverrideUrl,
          contactName: submission.contactName,
          imageUrl: submission.imageUrl,
          featured: featured,
          approved: true,
          createdBy: submission.submittedBy,
          approvedBy: user.id,
          approvedDate: new Date(),
          card_tags: {
            create: tagIds.map((tagId) => ({
              tag_id: tagId,
            })),
          },
        },
        include: {
          card_tags: {
            include: {
              tags: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Update the submission
      const updatedSubmission = await prisma.cardSubmission.update({
        where: { id: submissionId },
        data: {
          status: "approved",
          reviewedBy: user.id,
          reviewedDate: new Date(),
          reviewNotes: notes,
          cardId: card.id,
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

      // Transform card to API format
      const transformedCard = {
        id: card.id,
        name: card.name,
        description: card.description,
        website_url: card.websiteUrl,
        phone_number: card.phoneNumber,
        email: card.email,
        address: card.address,
        address_override_url: card.addressOverrideUrl,
        contact_name: card.contactName,
        image_url: card.imageUrl,
        featured: card.featured || false,
        approved: card.approved || false,
        created_date: card.createdDate?.toISOString(),
        updated_date: card.updatedDate?.toISOString(),
        created_by: card.createdBy,
        creator: card.creator
          ? {
              id: card.creator.id,
              first_name: card.creator.firstName,
              last_name: card.creator.lastName,
              email: card.creator.email,
            }
          : null,
        approved_by: card.approvedBy,
        approver: card.approver
          ? {
              id: card.approver.id,
              first_name: card.approver.firstName,
              last_name: card.approver.lastName,
              email: card.approver.email,
            }
          : null,
        approved_date: card.approvedDate?.toISOString(),
        tags: card.card_tags.map((ct) => ct.tags.name),
      };

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
        message: "Submission approved successfully",
        card: transformedCard,
        submission: transformedSubmission,
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);
