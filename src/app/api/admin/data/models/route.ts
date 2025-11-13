import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/data/models - Get list of available models with record counts (admin only)
 */
export const GET = withAuth(
  async () => {
    try {
      // Get record counts for all models
      const [
        userCount,
        tagCount,
        cardCount,
        cardSubmissionCount,
        cardModificationCount,
        resourceCategoryCount,
        quickAccessItemCount,
        resourceItemCount,
        resourceConfigCount,
        reviewCount,
        forumCategoryCount,
        forumCategoryRequestCount,
        forumThreadCount,
        forumPostCount,
        forumReportCount,
        helpWantedPostCount,
        helpWantedCommentCount,
        helpWantedReportCount,
        supportTicketCount,
        supportTicketMessageCount,
        indexingJobCount,
        tokenBlacklistCount,
        cardTagsCount,
        alembicVersionCount,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.tag.count(),
        prisma.card.count(),
        prisma.cardSubmission.count(),
        prisma.cardModification.count(),
        prisma.resourceCategory.count(),
        prisma.quickAccessItem.count(),
        prisma.resourceItem.count(),
        prisma.resourceConfig.count(),
        prisma.review.count(),
        prisma.forumCategory.count(),
        prisma.forumCategoryRequest.count(),
        prisma.forumThread.count(),
        prisma.forumPost.count(),
        prisma.forumReport.count(),
        prisma.helpWantedPost.count(),
        prisma.helpWantedComment.count(),
        prisma.helpWantedReport.count(),
        prisma.supportTicket.count(),
        prisma.supportTicketMessage.count(),
        prisma.indexingJob.count(),
        prisma.tokenBlacklist.count(),
        prisma.card_tags.count(),
        prisma.alembic_version.count(),
      ]);

      const models = [
        { name: "User", count: userCount },
        { name: "Tag", count: tagCount },
        { name: "Card", count: cardCount },
        { name: "CardSubmission", count: cardSubmissionCount },
        { name: "CardModification", count: cardModificationCount },
        { name: "ResourceCategory", count: resourceCategoryCount },
        { name: "QuickAccessItem", count: quickAccessItemCount },
        { name: "ResourceItem", count: resourceItemCount },
        { name: "ResourceConfig", count: resourceConfigCount },
        { name: "Review", count: reviewCount },
        { name: "ForumCategory", count: forumCategoryCount },
        { name: "ForumCategoryRequest", count: forumCategoryRequestCount },
        { name: "ForumThread", count: forumThreadCount },
        { name: "ForumPost", count: forumPostCount },
        { name: "ForumReport", count: forumReportCount },
        { name: "HelpWantedPost", count: helpWantedPostCount },
        { name: "HelpWantedComment", count: helpWantedCommentCount },
        { name: "HelpWantedReport", count: helpWantedReportCount },
        { name: "SupportTicket", count: supportTicketCount },
        { name: "SupportTicketMessage", count: supportTicketMessageCount },
        { name: "IndexingJob", count: indexingJobCount },
        { name: "TokenBlacklist", count: tokenBlacklistCount },
        { name: "card_tags", count: cardTagsCount },
        { name: "alembic_version", count: alembicVersionCount },
      ];

      return NextResponse.json({ models });
    } catch (error) {
      logger.error("Error fetching model counts:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to fetch model information",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
