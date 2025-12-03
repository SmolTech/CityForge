import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { handleApiError } from "@/lib/errors/api-error";

/**
 * PUT /api/admin/cards/[id] - Update card (admin only)
 */
export const PUT = withCsrfProtection(
  withAuth(
    async (
      request: NextRequest,
      _context,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const { id } = await params;
        const cardId = parseInt(id);

        if (isNaN(cardId)) {
          return NextResponse.json(
            {
              error: {
                message: "Invalid card ID",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        const body = await request.json();
        const {
          name,
          description,
          website_url,
          phone_number,
          email,
          address,
          address_override_url,
          contact_name,
          featured,
          approved,
          tags,
        } = body;

        // Check if card exists
        const existingCard = await prisma.card.findUnique({
          where: { id: cardId },
          include: {
            card_tags: {
              include: {
                tags: true,
              },
            },
          },
        });

        if (!existingCard) {
          return NextResponse.json(
            {
              error: {
                message: "Card not found",
                code: 404,
              },
            },
            { status: 404 }
          );
        }

        // Build update data for card
        const updateData: Record<string, any> = {};
        if (name !== undefined) updateData["name"] = name;
        if (description !== undefined) updateData["description"] = description;
        if (website_url !== undefined) updateData["websiteUrl"] = website_url;
        if (phone_number !== undefined)
          updateData["phoneNumber"] = phone_number;
        if (email !== undefined) updateData["email"] = email;
        if (address !== undefined) updateData["address"] = address;
        if (address_override_url !== undefined)
          updateData["addressOverrideUrl"] = address_override_url;
        if (contact_name !== undefined)
          updateData["contactName"] = contact_name;
        if (featured !== undefined) updateData["featured"] = featured;
        if (approved !== undefined) updateData["approved"] = approved;

        // Update the card in a transaction to handle tags
        await prisma.$transaction(async (tx) => {
          // Update the card
          await tx.card.update({
            where: { id: cardId },
            data: updateData,
          });

          // Handle tags if provided
          if (tags !== undefined && Array.isArray(tags)) {
            // Remove existing tag associations
            await tx.card_tags.deleteMany({
              where: { card_id: cardId },
            });

            // Add new tag associations
            for (const tagName of tags) {
              if (tagName.trim()) {
                // Create tag if it doesn't exist
                const tag = await tx.tag.upsert({
                  where: { name: tagName.trim() },
                  update: {},
                  create: { name: tagName.trim() },
                });

                // Create card-tag association
                await tx.card_tags.create({
                  data: {
                    card_id: cardId,
                    tag_id: tag.id,
                  },
                });
              }
            }
          }

          return;
        });

        // Get the updated card with tags and creator info
        const cardWithRelations = await prisma.card.findUnique({
          where: { id: cardId },
          include: {
            card_tags: {
              include: {
                tags: {
                  select: {
                    name: true,
                  },
                },
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

        // Transform to match API format
        const responseCard = {
          id: cardWithRelations!.id,
          name: cardWithRelations!.name,
          description: cardWithRelations!.description,
          website_url: cardWithRelations!.websiteUrl,
          phone_number: cardWithRelations!.phoneNumber,
          email: cardWithRelations!.email,
          address: cardWithRelations!.address,
          address_override_url: cardWithRelations!.addressOverrideUrl,
          contact_name: cardWithRelations!.contactName,
          image_url: cardWithRelations!.imageUrl,
          featured: cardWithRelations!.featured || false,
          approved: cardWithRelations!.approved || false,
          created_date: cardWithRelations!.createdDate?.toISOString(),
          updated_date: cardWithRelations!.updatedDate?.toISOString(),
          created_by: cardWithRelations!.createdBy,
          creator: cardWithRelations!.creator
            ? {
                id: cardWithRelations!.creator.id,
                first_name: cardWithRelations!.creator.firstName,
                last_name: cardWithRelations!.creator.lastName,
                email: cardWithRelations!.creator.email,
              }
            : null,
          approved_by: cardWithRelations!.approvedBy,
          approver: cardWithRelations!.approver
            ? {
                id: cardWithRelations!.approver.id,
                first_name: cardWithRelations!.approver.firstName,
                last_name: cardWithRelations!.approver.lastName,
                email: cardWithRelations!.approver.email,
              }
            : null,
          approved_date: cardWithRelations!.approvedDate?.toISOString(),
          tags: cardWithRelations!.card_tags.map((ct) => ct.tags.name),
        };

        return NextResponse.json(responseCard);
      } catch (error) {
        logger.error("Error updating card:", error);
        return handleApiError(error);
      }
    },
    { requireAdmin: true }
  )
);

/**
 * DELETE /api/admin/cards/[id] - Delete card (admin only)
 */
export const DELETE = withCsrfProtection(
  withAuth(
    async (
      _request: NextRequest,
      _context,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      try {
        const { id } = await params;
        const cardId = parseInt(id);

        if (isNaN(cardId)) {
          return NextResponse.json(
            {
              error: {
                message: "Invalid card ID",
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        // Check if card exists
        const existingCard = await prisma.card.findUnique({
          where: { id: cardId },
        });

        if (!existingCard) {
          return NextResponse.json(
            {
              error: {
                message: "Card not found",
                code: 404,
              },
            },
            { status: 404 }
          );
        }

        // Delete card in a transaction to handle related records
        await prisma.$transaction(async (tx) => {
          // Delete card-tag associations
          await tx.card_tags.deleteMany({
            where: { card_id: cardId },
          });

          // Delete card reviews
          await tx.review.deleteMany({
            where: { cardId: cardId },
          });

          // Delete card modifications
          await tx.cardModification.deleteMany({
            where: { cardId: cardId },
          });

          // Delete card submissions
          await tx.cardSubmission.deleteMany({
            where: { cardId: cardId },
          });

          // Finally, delete the card
          await tx.card.delete({
            where: { id: cardId },
          });
        });

        return NextResponse.json({
          message: "Card deleted successfully",
        });
      } catch (error) {
        logger.error("Error deleting card:", error);
        return handleApiError(error);
      }
    },
    { requireAdmin: true }
  )
);
