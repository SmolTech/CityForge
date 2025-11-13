import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/data/import - Import data from uploaded JSON file (admin only)
 * Deletes ALL existing data and replaces with imported data
 * Form data: { file: File, confirm: "DELETE ALL DATA", include?: string }
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const confirm = formData.get("confirm") as string;
      const includeParam = formData.get("include") as string;

      // Validation
      if (!file) {
        return NextResponse.json(
          {
            error: {
              message: "No file uploaded",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      if (confirm !== "DELETE ALL DATA") {
        return NextResponse.json(
          {
            error: {
              message: 'Must type "DELETE ALL DATA" to confirm',
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      if (!file.name.endsWith(".json")) {
        return NextResponse.json(
          {
            error: {
              message: "File must be a JSON file",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Parse uploaded file
      const fileContent = await file.text();
      let importData: Record<string, unknown>;

      try {
        importData = JSON.parse(fileContent);
      } catch {
        return NextResponse.json(
          {
            error: {
              message: "Invalid JSON file",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Parse include parameter
      const includeModels = includeParam
        ? includeParam.split(",").map((s) => s.trim())
        : Object.keys(importData);

      // Define import order (to handle foreign key dependencies)
      // Junction/relationship tables must come AFTER their referenced tables
      const importOrder = [
        "User",
        "Tag",
        "ResourceCategory",
        "Card",
        "card_tags", // Must come after Tag and Card
        "CardSubmission",
        "CardModification",
        "QuickAccessItem",
        "ResourceItem",
        "ResourceConfig",
        "Review",
        "ForumCategory",
        "ForumCategoryRequest",
        "ForumThread",
        "ForumPost",
        "ForumReport",
        "HelpWantedPost",
        "HelpWantedComment",
        "HelpWantedReport",
        "SupportTicket",
        "SupportTicketMessage",
        "IndexingJob",
        "TokenBlacklist",
        "alembic_version",
      ];

      // Validate that all requested models exist in import data
      const missingModels = includeModels.filter(
        (model) => !(model in importData) || !Array.isArray(importData[model])
      );
      if (missingModels.length > 0) {
        return NextResponse.json(
          {
            error: {
              message: `Missing or invalid data for models: ${missingModels.join(", ")}`,
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Perform import in transaction
      const importStats: Record<string, { added: number }> = {};

      await prisma.$transaction(async (tx) => {
        // Delete existing data in reverse dependency order
        const deleteOrder = [...importOrder].reverse();

        for (const modelName of deleteOrder) {
          if (includeModels.includes(modelName)) {
            try {
              let deleteCount = 0;
              switch (modelName) {
                case "User":
                  deleteCount = await tx.user.count();
                  await tx.user.deleteMany();
                  break;
                case "Tag":
                  deleteCount = await tx.tag.count();
                  await tx.tag.deleteMany();
                  break;
                case "Card":
                  deleteCount = await tx.card.count();
                  await tx.card.deleteMany();
                  break;
                case "CardSubmission":
                  deleteCount = await tx.cardSubmission.count();
                  await tx.cardSubmission.deleteMany();
                  break;
                case "CardModification":
                  deleteCount = await tx.cardModification.count();
                  await tx.cardModification.deleteMany();
                  break;
                case "ResourceCategory":
                  deleteCount = await tx.resourceCategory.count();
                  await tx.resourceCategory.deleteMany();
                  break;
                case "QuickAccessItem":
                  deleteCount = await tx.quickAccessItem.count();
                  await tx.quickAccessItem.deleteMany();
                  break;
                case "ResourceItem":
                  deleteCount = await tx.resourceItem.count();
                  await tx.resourceItem.deleteMany();
                  break;
                case "ResourceConfig":
                  deleteCount = await tx.resourceConfig.count();
                  await tx.resourceConfig.deleteMany();
                  break;
                case "Review":
                  deleteCount = await tx.review.count();
                  await tx.review.deleteMany();
                  break;
                case "ForumCategory":
                  deleteCount = await tx.forumCategory.count();
                  await tx.forumCategory.deleteMany();
                  break;
                case "ForumCategoryRequest":
                  deleteCount = await tx.forumCategoryRequest.count();
                  await tx.forumCategoryRequest.deleteMany();
                  break;
                case "ForumThread":
                  deleteCount = await tx.forumThread.count();
                  await tx.forumThread.deleteMany();
                  break;
                case "ForumPost":
                  deleteCount = await tx.forumPost.count();
                  await tx.forumPost.deleteMany();
                  break;
                case "ForumReport":
                  deleteCount = await tx.forumReport.count();
                  await tx.forumReport.deleteMany();
                  break;
                case "HelpWantedPost":
                  deleteCount = await tx.helpWantedPost.count();
                  await tx.helpWantedPost.deleteMany();
                  break;
                case "HelpWantedComment":
                  deleteCount = await tx.helpWantedComment.count();
                  await tx.helpWantedComment.deleteMany();
                  break;
                case "HelpWantedReport":
                  deleteCount = await tx.helpWantedReport.count();
                  await tx.helpWantedReport.deleteMany();
                  break;
                case "SupportTicket":
                  deleteCount = await tx.supportTicket.count();
                  await tx.supportTicket.deleteMany();
                  break;
                case "SupportTicketMessage":
                  deleteCount = await tx.supportTicketMessage.count();
                  await tx.supportTicketMessage.deleteMany();
                  break;
                case "IndexingJob":
                  deleteCount = await tx.indexingJob.count();
                  await tx.indexingJob.deleteMany();
                  break;
                case "TokenBlacklist":
                  deleteCount = await tx.tokenBlacklist.count();
                  await tx.tokenBlacklist.deleteMany();
                  break;
                case "card_tags":
                  deleteCount = await tx.card_tags.count();
                  await tx.card_tags.deleteMany();
                  break;
                case "alembic_version":
                  deleteCount = await tx.alembic_version.count();
                  await tx.alembic_version.deleteMany();
                  break;
              }
              logger.info(
                `Deleted ${deleteCount} existing ${modelName} records`
              );
            } catch (error) {
              logger.error(`Error deleting ${modelName}:`, error);
              throw new Error(`Failed to delete existing ${modelName} data`);
            }
          }
        }

        // Insert new data in dependency order
        for (const modelName of importOrder) {
          if (includeModels.includes(modelName) && importData[modelName]) {
            const records = importData[modelName];
            if (!Array.isArray(records)) continue;

            try {
              let addedCount = 0;

              // Clean records by removing nested objects/relations for import
              const cleanRecords = records.map(
                (record: Record<string, unknown>) => {
                  const cleanRecord = { ...record };
                  // Remove relations and computed fields that would cause issues during import
                  Object.keys(cleanRecord).forEach((key) => {
                    if (
                      Array.isArray(cleanRecord[key]) &&
                      typeof cleanRecord[key][0] === "object"
                    ) {
                      delete cleanRecord[key]; // Remove relation arrays
                    }
                    if (
                      typeof cleanRecord[key] === "object" &&
                      cleanRecord[key] !== null &&
                      !(cleanRecord[key] as Date).getTime
                    ) {
                      delete cleanRecord[key]; // Remove relation objects (except dates)
                    }
                  });
                  return cleanRecord;
                }
              );

              switch (modelName) {
                case "User":
                  await tx.user.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "Tag":
                  await tx.tag.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "Card":
                  await tx.card.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "CardSubmission":
                  await tx.cardSubmission.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "CardModification":
                  await tx.cardModification.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "ResourceCategory":
                  await tx.resourceCategory.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "QuickAccessItem":
                  await tx.quickAccessItem.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "ResourceItem":
                  await tx.resourceItem.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "ResourceConfig":
                  await tx.resourceConfig.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "Review":
                  await tx.review.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "ForumCategory":
                  await tx.forumCategory.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "ForumCategoryRequest":
                  await tx.forumCategoryRequest.createMany({
                    data: cleanRecords,
                  });
                  addedCount = cleanRecords.length;
                  break;
                case "ForumThread":
                  await tx.forumThread.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "ForumPost":
                  await tx.forumPost.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "ForumReport":
                  await tx.forumReport.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "HelpWantedPost":
                  await tx.helpWantedPost.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "HelpWantedComment":
                  await tx.helpWantedComment.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "HelpWantedReport":
                  await tx.helpWantedReport.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "SupportTicket":
                  await tx.supportTicket.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "SupportTicketMessage":
                  await tx.supportTicketMessage.createMany({
                    data: cleanRecords,
                  });
                  addedCount = cleanRecords.length;
                  break;
                case "IndexingJob":
                  await tx.indexingJob.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "TokenBlacklist":
                  await tx.tokenBlacklist.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "card_tags":
                  await tx.card_tags.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
                case "alembic_version":
                  await tx.alembic_version.createMany({ data: cleanRecords });
                  addedCount = cleanRecords.length;
                  break;
              }

              importStats[modelName] = { added: addedCount };
              logger.info(`Imported ${addedCount} ${modelName} records`);
            } catch (error) {
              logger.error(`Error importing ${modelName}:`, error);
              throw new Error(
                `Failed to import ${modelName} data: ${(error as Error).message}`
              );
            }
          }
        }
      });

      return NextResponse.json({
        message: "Data import completed successfully!",
        stats: importStats,
      });
    } catch (error) {
      logger.error("Error during data import:", error);
      return NextResponse.json(
        {
          error: {
            message:
              error instanceof Error
                ? error.message
                : "Import failed. Please try again.",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
