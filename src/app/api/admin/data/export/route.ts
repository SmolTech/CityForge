import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/data/export - Export selected models to JSON (admin only)
 * Request body: { include?: string[] } - If omitted, exports all models
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const includeModels = body.include as string[] | undefined;

      // Define all available models and their corresponding Prisma queries
      const modelQueries = {
        User: () =>
          prisma.user.findMany({
            select: {
              // Basic user information (safe to export)
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
              emailVerified: true,
              createdDate: true,
              lastLogin: true,
              support: true,
              isSupporterFlag: true,

              // Explicitly exclude sensitive fields:
              // - passwordHash (security risk - could enable offline brute force)
              // - revokedTokens (token blacklist - reveals security events)
              // - emailVerificationToken (security risk)
              // - passwordResetTokens (security risk)
              // - Most activity relationships (privacy concern, excessive data)

              // Include only essential administrative relationships for business insights
              approvedCards: {
                select: {
                  id: true,
                  name: true,
                  approvedDate: true,
                },
              },
              createdCards: {
                select: {
                  id: true,
                  name: true,
                  createdDate: true,
                },
              },
            },
          }),
        Tag: () => prisma.tag.findMany({ include: { card_tags: true } }),
        Card: () =>
          prisma.card.findMany({
            include: {
              modifications: true,
              submissions: true,
              card_tags: true,
              approver: true,
              creator: true,
              reviews: true,
            },
          }),
        CardSubmission: () =>
          prisma.cardSubmission.findMany({
            include: { card: true, reviewer: true, submitter: true },
          }),
        CardModification: () =>
          prisma.cardModification.findMany({
            include: { card: true, reviewer: true, submitter: true },
          }),
        ResourceCategory: () =>
          prisma.resourceCategory.findMany({
            include: { resourceItems: true },
          }),
        QuickAccessItem: () => prisma.quickAccessItem.findMany(),
        ResourceItem: () =>
          prisma.resourceItem.findMany({ include: { categoryObj: true } }),
        ResourceConfig: () => prisma.resourceConfig.findMany(),
        Review: () =>
          prisma.review.findMany({
            include: { card: true, reporter: true, user: true },
          }),
        ForumCategory: () =>
          prisma.forumCategory.findMany({
            include: { creator: true, categoryRequests: true, threads: true },
          }),
        ForumCategoryRequest: () =>
          prisma.forumCategoryRequest.findMany({
            include: { category: true, requester: true, reviewer: true },
          }),
        ForumThread: () =>
          prisma.forumThread.findMany({
            include: {
              posts: true,
              reports: true,
              category: true,
              creator: true,
            },
          }),
        ForumPost: () =>
          prisma.forumPost.findMany({
            include: {
              creator: true,
              editor: true,
              thread: true,
              reports: true,
            },
          }),
        ForumReport: () =>
          prisma.forumReport.findMany({
            include: {
              post: true,
              reporter: true,
              reviewer: true,
              thread: true,
            },
          }),
        HelpWantedPost: () =>
          prisma.helpWantedPost.findMany({
            include: { comments: true, creator: true, reports: true },
          }),
        HelpWantedComment: () =>
          prisma.helpWantedComment.findMany({
            include: { creator: true, parent: true, replies: true, post: true },
          }),
        HelpWantedReport: () =>
          prisma.helpWantedReport.findMany({
            select: {
              id: true,
              reason: true,
              details: true,
              status: true,
              createdDate: true,
              reviewedDate: true,
              resolutionNotes: true,
              post: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  category: true,
                  status: true,
                  location: true,
                  createdDate: true,
                },
              },
              // SECURITY: Include only safe user fields, exclude sensitive data
              reporter: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
              reviewer: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          }),
        SupportTicket: () =>
          prisma.supportTicket.findMany({
            select: {
              id: true,
              title: true,
              description: true,
              category: true,
              status: true,
              priority: true,
              isAnonymous: true,
              createdDate: true,
              updatedDate: true,
              resolvedDate: true,
              closedDate: true,
              messages: {
                select: {
                  id: true,
                  content: true,
                  isInternalNote: true,
                  createdDate: true,
                  updatedDate: true,
                  // SECURITY: Include only safe user fields for message creators
                  creator: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      role: true,
                    },
                  },
                },
              },
              // SECURITY: Include only safe user fields, exclude sensitive data
              assignedSupporter: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
              creator: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          }),
        SupportTicketMessage: () =>
          prisma.supportTicketMessage.findMany({
            select: {
              id: true,
              content: true,
              isInternalNote: true,
              createdDate: true,
              updatedDate: true,
              // SECURITY: Include only safe user fields, exclude sensitive data
              creator: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
              ticket: {
                select: {
                  id: true,
                  title: true,
                  category: true,
                  status: true,
                  priority: true,
                  createdDate: true,
                },
              },
            },
          }),
        IndexingJob: () => prisma.indexingJob.findMany(),
        TokenBlacklist: () =>
          prisma.tokenBlacklist.findMany({
            select: {
              id: true,
              jti: true,
              tokenType: true,
              revokedAt: true,
              expiresAt: true,
              // SECURITY: Include only userId reference, NOT full user data
              // Exporting user data alongside security tokens is a security risk
              userId: true,
            },
          }),
        card_tags: () =>
          prisma.card_tags.findMany({ include: { cards: true, tags: true } }),
        alembic_version: () => prisma.alembic_version.findMany(),
      };

      // Determine which models to export
      const modelsToExport = includeModels || Object.keys(modelQueries);

      // Validate requested models
      const invalidModels = modelsToExport.filter(
        (model) => !(model in modelQueries)
      );
      if (invalidModels.length > 0) {
        return NextResponse.json(
          {
            error: {
              message: `Invalid models: ${invalidModels.join(", ")}`,
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Export data
      const exportData: Record<string, unknown[]> = {};

      for (const modelName of modelsToExport) {
        try {
          const queryFn = modelQueries[modelName as keyof typeof modelQueries];
          exportData[modelName] = await queryFn();
          logger.info(
            `Exported ${modelName}: ${exportData[modelName].length} records`
          );
        } catch (error) {
          logger.error(`Error exporting ${modelName}:`, error);
          return NextResponse.json(
            {
              error: {
                message: `Failed to export model: ${modelName}`,
                code: 500,
              },
            },
            { status: 500 }
          );
        }
      }

      // Create response with proper headers for download
      const exportJson = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `cityforge_export_${timestamp}.json`;

      return new NextResponse(exportJson, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      logger.error("Error during data export:", error);
      return NextResponse.json(
        {
          error: {
            message: "Export failed. Please try again.",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
