import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/errors/api-error";

export const POST = withAuth(
  async (
    request: NextRequest,
    _context,
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

      // Get the modification with card data
      const modification = await prisma.cardModification.findUnique({
        where: { id: modificationId },
        include: {
          card: true,
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

      // Get the current user from request context
      const user = (request as any).user as { id: number };
      if (!user) {
        return NextResponse.json(
          { error: "User not found in request context" },
          { status: 401 }
        );
      }

      // Use a transaction to update both the modification and the card
      await prisma.$transaction(async (tx) => {
        // Update the modification status
        await tx.cardModification.update({
          where: { id: modificationId },
          data: {
            status: "approved",
            reviewedBy: user.id,
            reviewedDate: new Date(),
          },
        });

        // Parse tags text if provided
        let tagNames: string[] = [];
        if (modification.tagsText) {
          tagNames = modification.tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
        }

        // Update the card with the new data
        await tx.card.update({
          where: { id: modification.cardId },
          data: {
            name: modification.name,
            description: modification.description,
            websiteUrl: modification.websiteUrl,
            phoneNumber: modification.phoneNumber,
            email: modification.email,
            address: modification.address,
            addressOverrideUrl: modification.addressOverrideUrl,
            contactName: modification.contactName,
            imageUrl: modification.imageUrl,
            updatedDate: new Date(),
          },
        });

        // Handle tag updates if tags were provided
        if (tagNames.length > 0) {
          // Remove existing tag associations
          await tx.card_tags.deleteMany({
            where: { card_id: modification.cardId },
          });

          // Create or find tags and create new associations
          for (const tagName of tagNames) {
            const tag = await tx.tag.upsert({
              where: { name: tagName },
              create: {
                name: tagName,
                createdDate: new Date(),
              },
              update: {},
            });

            await tx.card_tags.create({
              data: {
                card_id: modification.cardId,
                tag_id: tag.id,
              },
            });
          }
        }
      });

      // Get the updated modification and card for response
      const [updatedModification, updatedCard] = await Promise.all([
        prisma.cardModification.findUnique({
          where: { id: modificationId },
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
        }),
        prisma.card.findUnique({
          where: { id: modification.cardId },
          include: {
            card_tags: {
              include: {
                tags: true,
              },
            },
          },
        }),
      ]);

      // Transform the response to match the expected format
      const transformedModification = {
        id: updatedModification!.id,
        card_id: updatedModification!.cardId,
        name: updatedModification!.name,
        description: updatedModification!.description,
        website_url: updatedModification!.websiteUrl,
        phone_number: updatedModification!.phoneNumber,
        email: updatedModification!.email,
        address: updatedModification!.address,
        address_override_url: updatedModification!.addressOverrideUrl,
        contact_name: updatedModification!.contactName,
        image_url: updatedModification!.imageUrl,
        status: updatedModification!.status,
        review_notes: updatedModification!.reviewNotes,
        created_date: updatedModification!.createdDate?.toISOString(),
        submitted_by: updatedModification!.submittedBy,
        submitter: updatedModification!.submitter
          ? {
              id: updatedModification!.submitter.id,
              first_name: updatedModification!.submitter.firstName,
              last_name: updatedModification!.submitter.lastName,
              email: updatedModification!.submitter.email,
            }
          : null,
        reviewed_by: updatedModification!.reviewedBy,
        reviewer: updatedModification!.reviewer
          ? {
              id: updatedModification!.reviewer.id,
              first_name: updatedModification!.reviewer.firstName,
              last_name: updatedModification!.reviewer.lastName,
              email: updatedModification!.reviewer.email,
            }
          : null,
        reviewed_date: updatedModification!.reviewedDate?.toISOString(),
      };

      const transformedCard = {
        id: updatedCard!.id,
        name: updatedCard!.name,
        description: updatedCard!.description,
        website_url: updatedCard!.websiteUrl,
        phone_number: updatedCard!.phoneNumber,
        email: updatedCard!.email,
        address: updatedCard!.address,
        address_override_url: updatedCard!.addressOverrideUrl,
        contact_name: updatedCard!.contactName,
        featured: updatedCard!.featured,
        image_url: updatedCard!.imageUrl,
        created_by: updatedCard!.createdBy,
        approved: updatedCard!.approved,
        approved_by: updatedCard!.approvedBy,
        approved_date: updatedCard!.approvedDate?.toISOString(),
        created_date: updatedCard!.createdDate?.toISOString(),
        updated_date: updatedCard!.updatedDate?.toISOString(),
        tags: updatedCard!.card_tags.map(
          (ct: { tags: { id: number; name: string } }) => ({
            id: ct.tags.id,
            name: ct.tags.name,
          })
        ),
      };

      return NextResponse.json({
        message: "Modification approved and card updated successfully",
        modification: transformedModification,
        card: transformedCard,
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  { requireAdmin: true }
);
