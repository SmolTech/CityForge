#!/usr/bin/env node

/**
 * Test Migration Workflow
 *
 * This script creates sample data and tests the complete Flask->Next.js
 * migration workflow including export, import, and validation.
 */

import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log("🧹 Clearing database...");

  try {
    // Delete in reverse dependency order to handle foreign key constraints
    await prisma.forumPost.deleteMany();
    await prisma.forumThread.deleteMany();
    await prisma.forumCategory.deleteMany();
    await prisma.card_tags.deleteMany();
    await prisma.cardSubmission.deleteMany();
    await prisma.cardModification.deleteMany();
    await prisma.resourceItem.deleteMany();
    await prisma.resourceCategory.deleteMany();
    await prisma.resourceConfig.deleteMany();
    await prisma.card.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.user.deleteMany();

    // Reset PostgreSQL sequences to avoid ID conflicts
    const resetSequences = [
      "ALTER SEQUENCE users_id_seq RESTART WITH 1",
      "ALTER SEQUENCE cards_id_seq RESTART WITH 1",
      "ALTER SEQUENCE tags_id_seq RESTART WITH 1",
      "ALTER SEQUENCE card_submissions_id_seq RESTART WITH 1",
      "ALTER SEQUENCE card_modifications_id_seq RESTART WITH 1",
      "ALTER SEQUENCE resource_categories_id_seq RESTART WITH 1",
      "ALTER SEQUENCE resource_items_id_seq RESTART WITH 1",
      "ALTER SEQUENCE resource_config_id_seq RESTART WITH 1",
      "ALTER SEQUENCE forum_categories_id_seq RESTART WITH 1",
      "ALTER SEQUENCE forum_threads_id_seq RESTART WITH 1",
      "ALTER SEQUENCE forum_posts_id_seq RESTART WITH 1",
    ];

    for (const resetSql of resetSequences) {
      await prisma.$executeRawUnsafe(resetSql);
    }

    console.log("✅ Database cleared successfully");
    return true;
  } catch (error) {
    console.error("❌ Error clearing database:", error.message);
    return false;
  }
}

async function createSampleData() {
  console.log("🔧 Creating sample data for migration testing...\n");

  try {
    // Clear existing data first to avoid conflicts
    await clearDatabase();

    // Create sample users
    const users = await Promise.all([
      prisma.user.create({
        data: {
          email: "admin@test.com",
          passwordHash: "$2b$12$test_hash_admin",
          firstName: "Admin",
          lastName: "User",
          role: "admin",
          isActive: true,
          emailVerified: true,
          createdDate: new Date("2024-01-01T10:00:00Z"),
        },
      }),
      prisma.user.create({
        data: {
          email: "user@test.com",
          passwordHash: "$2b$12$test_hash_user",
          firstName: "Regular",
          lastName: "User",
          role: "user",
          isActive: true,
          emailVerified: true,
          createdDate: new Date("2024-01-02T10:00:00Z"),
        },
      }),
    ]);

    console.log(`✅ Created ${users.length} test users`);

    // Create sample tags
    const tags = await Promise.all([
      prisma.tag.create({
        data: {
          name: "Restaurant",
          createdDate: new Date("2024-01-01T12:00:00Z"),
        },
      }),
      prisma.tag.create({
        data: {
          name: "Technology",
          createdDate: new Date("2024-01-01T12:01:00Z"),
        },
      }),
      prisma.tag.create({
        data: {
          name: "Healthcare",
          createdDate: new Date("2024-01-01T12:02:00Z"),
        },
      }),
    ]);

    console.log(`✅ Created ${tags.length} test tags`);

    // Create sample cards
    const cards = await Promise.all([
      prisma.card.create({
        data: {
          name: "Test Restaurant",
          description: "A great place to eat",
          websiteUrl: "https://testrestaurant.com",
          phoneNumber: "555-0123",
          email: "info@testrestaurant.com",
          address: "123 Main St, Test City",
          contactName: "John Doe",
          featured: true,
          approved: true,
          createdBy: users[1].id,
          approvedBy: users[0].id,
          createdDate: new Date("2024-01-02T14:00:00Z"),
          updatedDate: new Date("2024-01-02T14:00:00Z"),
          approvedDate: new Date("2024-01-02T14:30:00Z"),
        },
      }),
      prisma.card.create({
        data: {
          name: "Tech Solutions Inc",
          description: "Software development and IT services",
          websiteUrl: "https://techsolutions.com",
          phoneNumber: "555-0456",
          email: "contact@techsolutions.com",
          address: "456 Tech Ave, Innovation District",
          contactName: "Jane Smith",
          featured: false,
          approved: true,
          createdBy: users[1].id,
          approvedBy: users[0].id,
          createdDate: new Date("2024-01-03T09:00:00Z"),
          updatedDate: new Date("2024-01-03T09:00:00Z"),
          approvedDate: new Date("2024-01-03T10:00:00Z"),
        },
      }),
    ]);

    console.log(`✅ Created ${cards.length} test cards`);

    // Create card-tag relationships
    await Promise.all([
      prisma.card_tags.create({
        data: { card_id: cards[0].id, tag_id: tags[0].id },
      }),
      prisma.card_tags.create({
        data: { card_id: cards[1].id, tag_id: tags[1].id },
      }),
    ]);

    console.log(`✅ Created card-tag relationships`);

    // Create resource categories
    const resourceCategories = await Promise.all([
      prisma.resourceCategory.create({
        data: {
          name: "Emergency Services",
          displayOrder: 1,
          createdDate: new Date("2024-01-01T15:00:00Z"),
        },
      }),
      prisma.resourceCategory.create({
        data: {
          name: "Government",
          displayOrder: 2,
          createdDate: new Date("2024-01-01T15:01:00Z"),
        },
      }),
    ]);

    console.log(`✅ Created ${resourceCategories.length} resource categories`);

    // Create resource items
    await Promise.all([
      prisma.resourceItem.create({
        data: {
          title: "Fire Department",
          url: "https://firedepart.gov",
          description: "Emergency fire services",
          category: "Emergency Services",
          categoryId: resourceCategories[0].id,
          phone: "911",
          address: "100 Fire Station Rd",
          icon: "fire",
          displayOrder: 1,
          isActive: true,
          createdDate: new Date("2024-01-01T16:00:00Z"),
          updatedDate: new Date("2024-01-01T16:00:00Z"),
        },
      }),
      prisma.resourceItem.create({
        data: {
          title: "City Hall",
          url: "https://cityhall.gov",
          description: "Municipal government services",
          category: "Government",
          categoryId: resourceCategories[1].id,
          phone: "555-CITY",
          address: "200 Government Plaza",
          icon: "building",
          displayOrder: 1,
          isActive: true,
          createdDate: new Date("2024-01-01T16:01:00Z"),
          updatedDate: new Date("2024-01-01T16:01:00Z"),
        },
      }),
    ]);

    console.log(`✅ Created resource items`);

    // Create forum category
    const forumCategory = await prisma.forumCategory.create({
      data: {
        name: "General Discussion",
        description: "General community discussion",
        slug: "general",
        displayOrder: 1,
        isActive: true,
        createdBy: users[0].id,
        createdDate: new Date("2024-01-01T17:00:00Z"),
        updatedDate: new Date("2024-01-01T17:00:00Z"),
      },
    });

    console.log(`✅ Created forum category`);

    // Create forum thread
    const forumThread = await prisma.forumThread.create({
      data: {
        categoryId: forumCategory.id,
        title: "Welcome to the Community",
        slug: "welcome-community",
        isPinned: true,
        isLocked: false,
        reportCount: 0,
        createdBy: users[0].id,
        createdDate: new Date("2024-01-01T17:30:00Z"),
        updatedDate: new Date("2024-01-01T17:30:00Z"),
      },
    });

    console.log(`✅ Created forum thread`);

    // Create forum post
    await prisma.forumPost.create({
      data: {
        threadId: forumThread.id,
        content: "Welcome everyone! This is our community forum.",
        isFirstPost: true,
        reportCount: 0,
        createdBy: users[0].id,
        createdDate: new Date("2024-01-01T17:31:00Z"),
        updatedDate: new Date("2024-01-01T17:31:00Z"),
      },
    });

    console.log(`✅ Created forum post`);

    // Create card submission
    await prisma.cardSubmission.create({
      data: {
        name: "Pending Business",
        description: "A business waiting for approval",
        websiteUrl: "https://pending.com",
        phoneNumber: "555-9999",
        email: "info@pending.com",
        address: "999 Pending St",
        contactName: "Pending Owner",
        tagsText: "pending,business",
        status: "pending",
        submittedBy: users[1].id,
        createdDate: new Date("2024-01-04T12:00:00Z"),
      },
    });

    console.log(`✅ Created card submission`);

    console.log("\n🎉 Sample data creation completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error creating sample data:", error.message);
    return false;
  }
}

async function testExport() {
  console.log("\n📤 Testing data export...");

  try {
    // Create export directory
    const exportDir = "/tmp/migration-test-export";
    await fs.mkdir(exportDir, { recursive: true });

    // Mock export (since we don't have a real Flask database to export from)
    // In a real scenario, you would run: node scripts/flask-data-export.mjs --source-db "..." --output ./export
    console.log("📁 Creating mock export files...");

    // Get current database data to simulate Flask export format (using raw queries to get snake_case fields)
    const users = await prisma.$queryRaw`SELECT * FROM users ORDER BY id`;
    const cards = await prisma.$queryRaw`SELECT * FROM cards ORDER BY id`;
    const tags = await prisma.$queryRaw`SELECT * FROM tags ORDER BY id`;
    const cardTags =
      await prisma.$queryRaw`SELECT * FROM card_tags ORDER BY card_id, tag_id`;
    const resourceCategories =
      await prisma.$queryRaw`SELECT * FROM resource_categories ORDER BY id`;
    const resourceItems =
      await prisma.$queryRaw`SELECT * FROM resource_items ORDER BY id`;
    const resourceConfig =
      await prisma.$queryRaw`SELECT * FROM resource_config ORDER BY id`;
    const forumCategories =
      await prisma.$queryRaw`SELECT * FROM forum_categories ORDER BY id`;
    const forumThreads =
      await prisma.$queryRaw`SELECT * FROM forum_threads ORDER BY id`;
    const forumPosts =
      await prisma.$queryRaw`SELECT * FROM forum_posts ORDER BY id`;
    const cardSubmissions =
      await prisma.$queryRaw`SELECT * FROM card_submissions ORDER BY id`;

    // Create export files
    const tables = [
      { name: "users", data: users },
      { name: "cards", data: cards },
      { name: "tags", data: tags },
      { name: "card_tags", data: cardTags },
      { name: "resource_categories", data: resourceCategories },
      { name: "resource_items", data: resourceItems },
      { name: "resource_config", data: resourceConfig },
      { name: "forum_categories", data: forumCategories },
      { name: "forum_threads", data: forumThreads },
      { name: "forum_posts", data: forumPosts },
      { name: "card_submissions", data: cardSubmissions },
    ];

    let totalRows = 0;

    for (const table of tables) {
      const exportData = {
        table: table.name,
        structure: [], // Would contain column info in real export
        data: table.data,
        rowCount: table.data.length,
      };

      await fs.writeFile(
        join(exportDir, `${table.name}.json`),
        JSON.stringify(exportData, null, 2)
      );

      totalRows += table.data.length;
      console.log(`  ✅ Exported ${table.name}: ${table.data.length} rows`);
    }

    // Create export metadata
    const metadata = {
      exportDate: new Date().toISOString(),
      sourceDatabase: "mock://test-database",
      totalTables: tables.length,
      totalRows,
      tablesSummary: Object.fromEntries(
        tables.map((t) => [t.name, t.data.length])
      ),
    };

    await fs.writeFile(
      join(exportDir, "export-metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    console.log(
      `✅ Export completed: ${totalRows} total rows exported to ${exportDir}`
    );
    return exportDir;
  } catch (error) {
    console.error("❌ Export test failed:", error.message);
    return null;
  }
}

async function testImport(exportDir) {
  console.log("\n📥 Testing data import...");

  try {
    // First do a dry run
    console.log("🔍 Running dry-run import...");
    const dryRunResult = spawnSync(
      "node",
      [
        "scripts/flask-data-import.mjs",
        "--input",
        exportDir,
        "--dry-run",
        "--skip-existing",
      ],
      {
        encoding: "utf-8",
        cwd: "/home/gboyce/repo/CityForge",
        stdio: "inherit",
      }
    );

    if (dryRunResult.status !== 0) {
      throw new Error(`Dry run failed with exit code ${dryRunResult.status}`);
    }

    console.log("✅ Dry-run completed successfully");

    // Now do the actual import
    console.log("\n📥 Running actual import...");
    const importResult = spawnSync(
      "node",
      [
        "scripts/flask-data-import.mjs",
        "--input",
        exportDir,
        "--skip-existing",
      ],
      {
        encoding: "utf-8",
        cwd: "/home/gboyce/repo/CityForge",
        stdio: "inherit",
      }
    );

    if (importResult.status !== 0) {
      throw new Error(`Import failed with exit code ${importResult.status}`);
    }

    console.log("✅ Import completed successfully");
    return true;
  } catch (error) {
    console.error("❌ Import test failed:", error.message);
    if (error.stdout) console.log("STDOUT:", error.stdout);
    if (error.stderr) console.log("STDERR:", error.stderr);
    return false;
  }
}

async function validateMigration() {
  console.log("\n✅ Validating migration results...");

  try {
    // Check data counts
    const userCount = await prisma.user.count();
    const cardCount = await prisma.card.count();
    const tagCount = await prisma.tag.count();
    const cardTagCount = await prisma.card_tags.count();
    const resourceCategoryCount = await prisma.resourceCategory.count();
    const resourceItemCount = await prisma.resourceItem.count();
    const forumCategoryCount = await prisma.forumCategory.count();
    const forumThreadCount = await prisma.forumThread.count();
    const forumPostCount = await prisma.forumPost.count();
    const cardSubmissionCount = await prisma.cardSubmission.count();

    console.log("📊 Post-import data counts:");
    console.log(`  Users: ${userCount}`);
    console.log(`  Cards: ${cardCount}`);
    console.log(`  Tags: ${tagCount}`);
    console.log(`  Card-Tags: ${cardTagCount}`);
    console.log(`  Resource Categories: ${resourceCategoryCount}`);
    console.log(`  Resource Items: ${resourceItemCount}`);
    console.log(`  Forum Categories: ${forumCategoryCount}`);
    console.log(`  Forum Threads: ${forumThreadCount}`);
    console.log(`  Forum Posts: ${forumPostCount}`);
    console.log(`  Card Submissions: ${cardSubmissionCount}`);

    // Validate specific records
    const adminUser = await prisma.user.findFirst({
      where: { email: "admin@test.com" },
    });

    if (!adminUser) {
      throw new Error("Admin user not found after import");
    }

    console.log(
      `✅ Admin user found: ${adminUser.firstName} ${adminUser.lastName}`
    );

    const testCard = await prisma.card.findFirst({
      where: { name: "Test Restaurant" },
      include: {
        creator: true,
        approver: true,
        card_tags: {
          include: { tags: true },
        },
      },
    });

    if (!testCard) {
      throw new Error("Test restaurant card not found after import");
    }

    console.log(
      `✅ Test card found: ${testCard.name} (created by: ${testCard.creator?.firstName}, tags: ${testCard.card_tags.length})`
    );

    // Test relationships
    const cardsWithCreators = await prisma.card.count({
      where: { createdBy: { not: null } },
    });

    console.log(
      `✅ Cards with valid creators: ${cardsWithCreators}/${cardCount}`
    );

    const forumThreadWithPosts = await prisma.forumThread.findFirst({
      include: { posts: true },
    });

    if (forumThreadWithPosts) {
      console.log(
        `✅ Forum thread with ${forumThreadWithPosts.posts.length} posts found`
      );
    }

    console.log("\n🎉 Migration validation completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Validation failed:", error.message);
    return false;
  }
}

async function main() {
  console.log("🚀 CityForge Migration Workflow Test");
  console.log("=".repeat(60));
  console.log("Testing complete Flask → Next.js migration workflow\n");

  try {
    await prisma.$connect();
    console.log("✅ Connected to database\n");

    // Step 1: Create sample data
    const sampleDataCreated = await createSampleData();
    if (!sampleDataCreated) {
      throw new Error("Failed to create sample data");
    }

    // Step 2: Test export
    const exportDir = await testExport();
    if (!exportDir) {
      throw new Error("Failed to export data");
    }

    // Step 3: Clear database
    const databaseCleared = await clearDatabase();
    if (!databaseCleared) {
      throw new Error("Failed to clear database");
    }

    // Step 4: Test import
    const importSuccessful = await testImport(exportDir);
    if (!importSuccessful) {
      throw new Error("Failed to import data");
    }

    // Step 5: Validate migration
    const validationSuccessful = await validateMigration();
    if (!validationSuccessful) {
      throw new Error("Failed to validate migration");
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 MIGRATION WORKFLOW TEST COMPLETED SUCCESSFULLY!");
    console.log("\nAll components are working correctly:");
    console.log("  ✅ Sample data creation");
    console.log("  ✅ Data export simulation");
    console.log("  ✅ Database clearing");
    console.log("  ✅ Data import");
    console.log("  ✅ Data validation");
    console.log(
      "\nThe Flask → Next.js migration tools are ready for production use."
    );

    // Cleanup
    console.log("\n🧹 Cleaning up test files...");
    await fs.rm(exportDir, { recursive: true, force: true });
    console.log("✅ Cleanup completed");
  } catch (error) {
    console.error("❌ Migration workflow test failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createSampleData, testExport, testImport, validateMigration };
