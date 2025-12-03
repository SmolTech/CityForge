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
 * GET /api/support-tickets/[id]
 * Get a specific support ticket with messages
 */
export const GET = withAuth(
  async (request: NextRequest, { user }, context: RouteContext) => {
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

      logger.info("Getting support ticket", {
        ticketId,
        userId: user.id,
        isSupporter: user.isSupporterFlag,
      });

      // Build where clause based on user role
      interface WhereClause {
        id: number;
        createdBy?: number;
      }
      const whereClause: WhereClause = { id: ticketId };

      // Non-supporters can only see their own tickets
      if (!hasSupportPermissions(user)) {
        whereClause.createdBy = user.id;
      }

      // Get ticket with full details and messages
      const ticket = await prisma.supportTicket.findFirst({
        where: whereClause,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assignedSupporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          messages: {
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
            orderBy: {
              createdDate: "asc",
            },
          },
        },
      });

      if (!ticket) {
        logger.warn("Support ticket not found or access denied", {
          ticketId,
          userId: user.id,
          isSupporter: user.isSupporterFlag,
        });
        return NextResponse.json(
          { error: { message: "Ticket not found", code: 404 } },
          { status: 404 }
        );
      }

      // Transform messages, filtering internal notes for non-supporters
      const transformedMessages = ticket.messages
        .filter((message) => {
          // Show internal notes only to supporters
          if (message.isInternalNote && !user.isSupporterFlag) {
            return false;
          }
          return true;
        })
        .map((message) => ({
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
        }));

      // Transform ticket to match expected format
      const transformedTicket = {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        status: ticket.status,
        priority: ticket.priority,
        is_anonymous: ticket.isAnonymous,
        created_date:
          ticket.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          ticket.updatedDate?.toISOString() ?? new Date().toISOString(),
        resolved_date: ticket.resolvedDate?.toISOString(),
        closed_date: ticket.closedDate?.toISOString(),
        creator: {
          id: ticket.creator.id,
          username: `${ticket.creator.firstName} ${ticket.creator.lastName}`,
          email: ticket.creator.email,
        },
        assigned_supporter: ticket.assignedSupporter
          ? {
              id: ticket.assignedSupporter.id,
              username: `${ticket.assignedSupporter.firstName} ${ticket.assignedSupporter.lastName}`,
              email: ticket.assignedSupporter.email,
            }
          : null,
        message_count: transformedMessages.length,
        messages: transformedMessages,
      };

      logger.info("Successfully fetched support ticket", {
        ticketId,
        userId: user.id,
        messageCount: transformedMessages.length,
      });

      const response = NextResponse.json(transformedTicket);

      // Cache for 30 seconds (ticket details change but not frequently)
      response.headers.set("Cache-Control", "public, max-age=30");

      return response;
    } catch (error) {
      logger.error("Error fetching support ticket", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: user.id,
        url: request.url,
      });
      return NextResponse.json(
        { error: { message: "Internal server error", code: 500 } },
        { status: 500 }
      );
    }
  }
);

/**
 * PUT /api/support-tickets/[id]
 * Update a support ticket
 */
export const PUT = withCsrfProtection(
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

      if (!data) {
        return NextResponse.json(
          { error: { message: "No data provided", code: 400 } },
          { status: 400 }
        );
      }

      logger.info("Updating support ticket", {
        ticketId,
        userId: user.id,
        isSupporter: user.isSupporterFlag,
        updateFields: Object.keys(data),
      });

      // Check if ticket exists and user has permission to update
      const existingTicket = await prisma.supportTicket.findFirst({
        where: {
          id: ticketId,
          ...(user.isSupporterFlag ? {} : { createdBy: user.id }),
        },
      });

      if (!existingTicket) {
        return NextResponse.json(
          { error: { message: "Ticket not found", code: 404 } },
          { status: 404 }
        );
      }

      // Validate update fields
      const allowedFields = [
        "title",
        "description",
        "category",
        "priority",
        "status",
        "assigned_to",
      ];
      const updateData: any = {};

      for (const [key, value] of Object.entries(data)) {
        if (allowedFields.includes(key)) {
          updateData[key === "assigned_to" ? "assignedTo" : key] = value;
        }
      }

      // Only supporters can assign tickets
      if ("assignedTo" in updateData && !hasSupportPermissions(user)) {
        delete updateData.assignedTo;
      }

      // Only supporters and ticket creators can change status
      if (
        "status" in updateData &&
        !hasSupportPermissions(user) &&
        existingTicket.createdBy !== user.id
      ) {
        delete updateData.status;
      }

      // Validate status if provided
      if (updateData.status) {
        const validStatuses = ["open", "in_progress", "resolved", "closed"];
        if (!validStatuses.includes(updateData.status)) {
          return NextResponse.json(
            {
              error: {
                message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
                code: 400,
              },
            },
            { status: 400 }
          );
        }

        // Set resolved/closed dates based on status
        if (
          updateData.status === "resolved" &&
          existingTicket.status !== "resolved"
        ) {
          updateData.resolvedDate = new Date();
        }
        if (
          updateData.status === "closed" &&
          existingTicket.status !== "closed"
        ) {
          updateData.closedDate = new Date();
        }
      }

      // Validate priority if provided
      if (updateData.priority) {
        const validPriorities = ["low", "normal", "high", "urgent"];
        if (!validPriorities.includes(updateData.priority)) {
          return NextResponse.json(
            {
              error: {
                message: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
                code: 400,
              },
            },
            { status: 400 }
          );
        }
      }

      // Validate category if provided
      if (updateData.category) {
        const validCategories = [
          "housing",
          "food",
          "transportation",
          "healthcare",
          "financial",
          "other",
        ];
        if (!validCategories.includes(updateData.category)) {
          return NextResponse.json(
            {
              error: {
                message: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
                code: 400,
              },
            },
            { status: 400 }
          );
        }
      }

      // Update the ticket
      const updatedTicket = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assignedSupporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          messages: {
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
            orderBy: {
              createdDate: "asc",
            },
          },
        },
      });

      // Transform response (same as GET)
      const transformedMessages = updatedTicket.messages
        .filter((message) => {
          if (message.isInternalNote && !user.isSupporterFlag) {
            return false;
          }
          return true;
        })
        .map((message) => ({
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
        }));

      const transformedTicket = {
        id: updatedTicket.id,
        title: updatedTicket.title,
        description: updatedTicket.description,
        category: updatedTicket.category,
        status: updatedTicket.status,
        priority: updatedTicket.priority,
        is_anonymous: updatedTicket.isAnonymous,
        created_date:
          updatedTicket.createdDate?.toISOString() ?? new Date().toISOString(),
        updated_date:
          updatedTicket.updatedDate?.toISOString() ?? new Date().toISOString(),
        resolved_date: updatedTicket.resolvedDate?.toISOString(),
        closed_date: updatedTicket.closedDate?.toISOString(),
        creator: {
          id: updatedTicket.creator.id,
          username: `${updatedTicket.creator.firstName} ${updatedTicket.creator.lastName}`,
          email: updatedTicket.creator.email,
        },
        assigned_supporter: updatedTicket.assignedSupporter
          ? {
              id: updatedTicket.assignedSupporter.id,
              username: `${updatedTicket.assignedSupporter.firstName} ${updatedTicket.assignedSupporter.lastName}`,
              email: updatedTicket.assignedSupporter.email,
            }
          : null,
        message_count: transformedMessages.length,
        messages: transformedMessages,
      };

      logger.info("Support ticket updated successfully", {
        ticketId,
        userId: user.id,
        updatedFields: Object.keys(updateData),
      });

      return NextResponse.json(transformedTicket);
    } catch (error) {
      logger.error("Error updating support ticket", {
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

/**
 * DELETE /api/support-tickets/[id]
 * Delete a support ticket
 */
export const DELETE = withCsrfProtection(
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

      logger.info("Deleting support ticket", {
        ticketId,
        userId: user.id,
        isSupporter: hasSupportPermissions(user),
      });

      // Check if ticket exists and user has permission to delete
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

      // Delete messages first (cascade)
      await prisma.supportTicketMessage.deleteMany({
        where: { ticketId },
      });

      // Delete the ticket
      await prisma.supportTicket.delete({
        where: { id: ticketId },
      });

      logger.info("Support ticket deleted successfully", {
        ticketId,
        userId: user.id,
      });

      return NextResponse.json({ message: "Ticket deleted successfully" });
    } catch (error) {
      logger.error("Error deleting support ticket", {
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
