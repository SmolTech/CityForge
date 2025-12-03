import { NextRequest, NextResponse } from "next/server";
import { withAuth, hasSupportPermissions } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/support-tickets/[id]/messages
 * Add a new message to a support ticket
 */
export const POST = withCsrfProtection(
  withAuth(async (request: NextRequest, { user }, context: RouteContext) => {
    try {
      const params = await context.params;
      const ticketIdStr = params?.id;
      if (!ticketIdStr) {
        return NextResponse.json(
          { error: { message: "Ticket ID required", code: 400 } },
          { status: 400 }
        );
      }

      const ticketId = parseInt(ticketIdStr, 10);
      if (isNaN(ticketId)) {
        return NextResponse.json(
          { error: { message: "Invalid ticket ID", code: 400 } },
          { status: 400 }
        );
      }

      const data = await request.json();

      if (!data?.content || typeof data.content !== "string") {
        return NextResponse.json(
          { error: { message: "Message content is required", code: 400 } },
          { status: 400 }
        );
      }

      logger.info("Adding message to support ticket", {
        ticketId,
        userId: user.id,
        isSupporter: user.isSupporterFlag,
        contentLength: data.content.length,
      });

      // Check if ticket exists and user has permission to add messages
      const existingTicket = await prisma.supportTicket.findFirst({
        where: {
          id: ticketId,
          ...(hasSupportPermissions(user) ? {} : { createdBy: user.id }),
        },
      });

      if (!existingTicket) {
        return NextResponse.json(
          { error: { message: "Ticket not found", code: 404 } },
          { status: 404 }
        );
      }

      // Validate is_internal_note flag
      const isInternalNote = Boolean(data.is_internal_note);

      // Only supporters can create internal notes
      if (isInternalNote && !hasSupportPermissions(user)) {
        return NextResponse.json(
          {
            error: {
              message: "Only supporters can create internal notes",
              code: 403,
            },
          },
          { status: 403 }
        );
      }

      // Create the message
      const message = await prisma.supportTicketMessage.create({
        data: {
          ticketId,
          createdBy: user.id,
          content: data.content.trim(),
          isInternalNote,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Update ticket's updated_date
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedDate: new Date() },
      });

      // Transform message to match expected format
      const transformedMessage = {
        id: message.id,
        ticket_id: message.ticketId,
        content: message.content,
        is_internal_note: message.isInternalNote,
        created_date:
          message.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          message.updatedDate?.toISOString() ?? new Date().toISOString(),
        creator: {
          id: message.creator.id,
          username: `${message.creator.firstName} ${message.creator.lastName}`,
          email: message.creator.email,
        },
      };

      logger.info("Support ticket message added successfully", {
        ticketId,
        messageId: message.id,
        userId: user.id,
        isInternalNote,
      });

      return NextResponse.json(transformedMessage, { status: 201 });
    } catch (error) {
      logger.error("Error adding support ticket message", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: user.id,
        url: request.url,
      });
      return NextResponse.json(
        { error: { message: "Internal server error", code: 500 } },
        { status: 500 }
      );
    }
  })
);
