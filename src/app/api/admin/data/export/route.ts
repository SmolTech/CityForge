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
            include: {
              reviewedModifications: true,
              cardModifications: true,
              reviewedSubmissions: true,
              cardSubmissions: true,
              approvedCards: true,
              createdCards: true,
              forumCategories: true,
              categoryRequests: true,
              reviewedCategoryRequests: true,
              forumPosts: true,
              editedForumPosts: true,
              forumReports: true,
              reviewedForumReports: true,
              forumThreads: true,
              helpWantedComments: true,
              helpWantedPosts: true,
              helpWantedReports: true,
              reviewedHelpWantedReports: true,
              reportedReviews: true,
              reviews: true,
              supportTicketMessages: true,
              assignedTickets: true,
              supportTickets: true,
              revokedTokens: true,
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
            include: { post: true, reporter: true, reviewer: true },
          }),
        SupportTicket: () =>
          prisma.supportTicket.findMany({
            include: { messages: true, assignedSupporter: true, creator: true },
          }),
        SupportTicketMessage: () =>
          prisma.supportTicketMessage.findMany({
            include: { creator: true, ticket: true },
          }),
        IndexingJob: () => prisma.indexingJob.findMany(),
        TokenBlacklist: () =>
          prisma.tokenBlacklist.findMany({ include: { user: true } }),
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
      const exportData: Record<string, any> = {};

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
