import { NextRequest, NextResponse } from "next/server";
import { withAuth, hasSupportPermissions } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { paginationUtils } from "@/lib/constants/pagination";

/**
 * GET /api/support-tickets
 * Get support tickets (filtered by user role)
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters - using general limits since support tickets aren't defined
    const { limit, offset } = paginationUtils.parseFromSearchParams(
      searchParams,
      100, // Max 100 tickets per request
      20 // Default 20 tickets per request
    );

    // Parse filter parameters
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const assignedToMe = searchParams.get("assigned_to_me") === "true";

    logger.info("Getting support tickets", {
      userId: user.id,
      isSupporter: user.isSupporterFlag,
      filters: { status, category, priority, assignedToMe },
      pagination: { limit, offset },
    });

    // Build where clause based on user role
    interface WhereClause {
      createdBy?: number;
      assignedTo?: number;
      status?: string;
      category?: string;
      priority?: string;
    }
    const whereClause: WhereClause = {};

    // Non-supporters can only see their own tickets
    if (!hasSupportPermissions(user)) {
      whereClause.createdBy = user.id;
    } else {
      // Supporters can see all tickets or filter by assignment
      if (assignedToMe) {
        whereClause.assignedTo = user.id;
      }
    }

    // Apply other filters
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;
    if (priority) whereClause.priority = priority;

    // Get total count
    const totalCount = await prisma.supportTicket.count({ where: whereClause });

    // Get tickets with creator and assignee info
    const tickets = await prisma.supportTicket.findMany({
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
        _count: {
          select: { messages: true },
        },
      },
      orderBy: [{ priority: "desc" }, { createdDate: "desc" }],
      skip: offset,
      take: limit,
    });

    // Transform to match expected format
    const transformedTickets = tickets.map((ticket) => ({
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
      message_count: ticket._count.messages,
    }));

    logger.info("Successfully fetched support tickets", {
      userId: user.id,
      count: transformedTickets.length,
      total: totalCount,
    });

    const response = NextResponse.json({
      tickets: transformedTickets,
      total: totalCount,
      offset,
      limit,
    });

    // Cache for 1 minute (tickets change frequently)
    response.headers.set("Cache-Control", "public, max-age=60");

    return response;
  } catch (error) {
    logger.error("Error fetching support tickets", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: user.id,
    });
    return NextResponse.json(
      { error: { message: "Internal server error", code: 500 } },
      { status: 500 }
    );
  }
});

/**
 * POST /api/support-tickets
 * Create a new support ticket
 */
export const POST = withCsrfProtection(
  withAuth(async (request: NextRequest, { user }) => {
    try {
      const data = await request.json();

      if (!data) {
        return NextResponse.json(
          { error: { message: "No data provided", code: 400 } },
          { status: 400 }
        );
      }

      // Validate required fields
      const { title, description, category } = data;
      if (!title || !description || !category) {
        return NextResponse.json(
          {
            error: {
              message: "Missing required fields: title, description, category",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Validate category
      const validCategories = [
        "housing",
        "food",
        "transportation",
        "healthcare",
        "financial",
        "other",
      ];
      if (!validCategories.includes(category)) {
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

      // Validate priority (optional)
      const validPriorities = ["low", "normal", "high", "urgent"];
      const priority = data.priority || "normal";
      if (!validPriorities.includes(priority)) {
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

      logger.info("Creating support ticket", {
        userId: user.id,
        title: title.substring(0, 50),
        category,
        priority,
      });

      // Create the ticket
      const ticket = await prisma.supportTicket.create({
        data: {
          title,
          description,
          category,
          priority,
          status: "open",
          isAnonymous: data.is_anonymous || false,
          createdBy: user.id,
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

      // Transform response
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
        assigned_supporter: null,
        message_count: 0,
      };

      logger.info("Support ticket created successfully", {
        ticketId: ticket.id,
        userId: user.id,
        category,
      });

      return NextResponse.json(transformedTicket, { status: 201 });
    } catch (error) {
      logger.error("Error creating support ticket", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: user.id,
      });
      return NextResponse.json(
        { error: { message: "Internal server error", code: 500 } },
        { status: 500 }
      );
    }
  })
);
