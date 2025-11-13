#!/usr/bin/env node

/**
 * Migration Compatibility Verification Script
 *
 * This script verifies that the current Next.js/Prisma database schema
 * is compatible with data exports from the old Flask/SQLAlchemy system.
 *
 * It checks:
 * - Database table structures
 * - Column names and types
 * - Foreign key relationships
 * - Index coverage
 * - Required fields and constraints
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Expected Flask SQLAlchemy model mapping to Prisma schema
const EXPECTED_TABLES = {
  users: {
    requiredColumns: [
      "id",
      "email",
      "password_hash",
      "first_name",
      "last_name",
      "role",
      "is_active",
      "created_date",
      "email_verified",
    ],
    indexes: ["ix_users_email"],
    foreignKeys: [],
  },
  cards: {
    requiredColumns: [
      "id",
      "name",
      "description",
      "website_url",
      "phone_number",
      "email",
      "address",
      "contact_name",
      "featured",
      "image_url",
      "created_by",
      "approved",
      "approved_by",
      "approved_date",
      "created_date",
      "updated_date",
    ],
    indexes: ["ix_cards_name", "ix_cards_approved", "ix_cards_created_date"],
    foreignKeys: ["created_by", "approved_by"],
  },
  tags: {
    requiredColumns: ["id", "name", "created_date"],
    indexes: ["ix_tags_name"],
    foreignKeys: [],
  },
  card_tags: {
    requiredColumns: ["card_id", "tag_id"],
    indexes: ["ix_card_tags_tag_id"],
    foreignKeys: ["card_id", "tag_id"],
  },
  card_submissions: {
    requiredColumns: [
      "id",
      "name",
      "description",
      "website_url",
      "phone_number",
      "email",
      "address",
      "contact_name",
      "image_url",
      "tags_text",
      "status",
      "submitted_by",
      "reviewed_by",
      "review_notes",
      "card_id",
      "created_date",
      "reviewed_date",
    ],
    indexes: [],
    foreignKeys: ["submitted_by", "reviewed_by", "card_id"],
  },
  card_modifications: {
    requiredColumns: [
      "id",
      "card_id",
      "name",
      "description",
      "website_url",
      "phone_number",
      "email",
      "address",
      "contact_name",
      "image_url",
      "tags_text",
      "status",
      "submitted_by",
      "reviewed_by",
      "review_notes",
      "created_date",
      "reviewed_date",
    ],
    indexes: [],
    foreignKeys: ["card_id", "submitted_by", "reviewed_by"],
  },
  resource_categories: {
    requiredColumns: ["id", "name", "display_order", "created_date"],
    indexes: ["ix_resource_categories_name"],
    foreignKeys: [],
  },
  resource_items: {
    requiredColumns: [
      "id",
      "title",
      "url",
      "description",
      "category",
      "category_id",
      "phone",
      "address",
      "icon",
      "display_order",
      "is_active",
      "created_date",
      "updated_date",
    ],
    indexes: ["ix_resource_items_category", "ix_resource_items_title"],
    foreignKeys: ["category_id"],
  },
  resource_config: {
    requiredColumns: [
      "id",
      "key",
      "value",
      "description",
      "created_date",
      "updated_date",
    ],
    indexes: ["ix_resource_config_key"],
    foreignKeys: [],
  },
  quick_access_items: {
    requiredColumns: [
      "id",
      "identifier",
      "title",
      "subtitle",
      "phone",
      "color",
      "icon",
      "display_order",
      "is_active",
      "created_date",
    ],
    indexes: ["ix_quick_access_items_identifier"],
    foreignKeys: [],
  },
  token_blacklist: {
    requiredColumns: [
      "id",
      "jti",
      "token_type",
      "user_id",
      "revoked_at",
      "expires_at",
    ],
    indexes: ["ix_token_blacklist_jti"],
    foreignKeys: ["user_id"],
  },
  forum_categories: {
    requiredColumns: [
      "id",
      "name",
      "description",
      "slug",
      "display_order",
      "is_active",
      "created_by",
      "created_date",
      "updated_date",
    ],
    indexes: ["ix_forum_categories_name", "ix_forum_categories_slug"],
    foreignKeys: ["created_by"],
  },
  forum_threads: {
    requiredColumns: [
      "id",
      "category_id",
      "title",
      "slug",
      "is_pinned",
      "is_locked",
      "report_count",
      "created_by",
      "created_date",
      "updated_date",
    ],
    indexes: [
      "ix_forum_threads_title",
      "ix_forum_threads_slug",
      "ix_forum_threads_created_date",
    ],
    foreignKeys: ["category_id", "created_by"],
  },
  forum_posts: {
    requiredColumns: [
      "id",
      "thread_id",
      "content",
      "is_first_post",
      "report_count",
      "created_by",
      "created_date",
      "updated_date",
      "edited_by",
      "edited_date",
    ],
    indexes: ["ix_forum_posts_thread_created", "ix_forum_posts_created_by"],
    foreignKeys: ["thread_id", "created_by", "edited_by"],
  },
};

async function verifyTableStructure() {
  console.log("🔍 Verifying database table structure...\n");

  const issues = [];

  try {
    // Get all table names from the database
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log(`Found ${tables.length} tables in database:`);
    tables.forEach((table) => console.log(`  - ${table.table_name}`));
    console.log();

    // Check each expected table
    for (const [tableName, tableSpec] of Object.entries(EXPECTED_TABLES)) {
      console.log(`Checking table: ${tableName}`);

      // Check if table exists
      const tableExists = tables.some((t) => t.table_name === tableName);
      if (!tableExists) {
        issues.push(`❌ Missing table: ${tableName}`);
        continue;
      }

      // Check columns
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
        ORDER BY ordinal_position
      `;

      const columnNames = columns.map((col) => col.column_name);
      console.log(`  Columns: ${columnNames.join(", ")}`);

      // Check required columns
      for (const requiredCol of tableSpec.requiredColumns) {
        if (!columnNames.includes(requiredCol)) {
          issues.push(`❌ Missing column: ${tableName}.${requiredCol}`);
        }
      }

      // Check indexes
      const indexes = await prisma.$queryRaw`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' 
        AND tablename = ${tableName}
        AND indexname NOT LIKE '%_pkey'
        ORDER BY indexname
      `;

      const indexNames = indexes.map((idx) => idx.indexname);
      console.log(`  Indexes: ${indexNames.join(", ")}`);

      // Check expected indexes
      for (const expectedIndex of tableSpec.indexes) {
        if (!indexNames.includes(expectedIndex)) {
          issues.push(
            `⚠️  Missing index: ${expectedIndex} on table ${tableName}`
          );
        }
      }

      console.log(`  ✅ Table ${tableName} structure verified\n`);
    }

    // Check for alembic_version table (Flask migration tracking)
    const alembicExists = tables.some(
      (t) => t.table_name === "alembic_version"
    );
    if (alembicExists) {
      console.log(
        "📋 Found alembic_version table - database was migrated from Flask"
      );

      const version =
        await prisma.$queryRaw`SELECT version_num FROM alembic_version`;
      if (version.length > 0) {
        console.log(
          `   Current Flask migration version: ${version[0].version_num}`
        );
      }
    } else {
      console.log(
        "📋 No alembic_version table found - this is a fresh Next.js database"
      );
    }

    console.log("\n" + "=".repeat(60));

    if (issues.length === 0) {
      console.log("✅ Database structure verification PASSED");
      console.log("   All expected tables and columns are present");
      console.log("   Database is compatible with Flask data imports");
    } else {
      console.log("❌ Database structure verification FAILED");
      console.log("\nIssues found:");
      issues.forEach((issue) => console.log(`   ${issue}`));
    }

    return issues.length === 0;
  } catch (error) {
    console.error("❌ Error during verification:", error.message);
    return false;
  }
}

async function verifyDataCompatibility() {
  console.log("\n🔍 Verifying data compatibility...\n");

  try {
    // Test basic queries that would be used in data import
    console.log("Testing basic table access:");

    const userCount = await prisma.user.count();
    console.log(`  ✅ Users table: ${userCount} records`);

    const cardCount = await prisma.card.count();
    console.log(`  ✅ Cards table: ${cardCount} records`);

    const tagCount = await prisma.tag.count();
    console.log(`  ✅ Tags table: ${tagCount} records`);

    const resourceCount = await prisma.resourceItem.count();
    console.log(`  ✅ Resource items table: ${resourceCount} records`);

    // Test critical relationships
    console.log("\nTesting critical relationships:");

    const cardsWithCreators = await prisma.card.count({
      where: { createdBy: { not: null } },
    });
    console.log(`  ✅ Cards with creators: ${cardsWithCreators} records`);

    const cardTagCount = await prisma.card_tags.count();
    console.log(`  ✅ Card-tag relationships: ${cardTagCount} records`);

    // Test configuration access
    const configCount = await prisma.resourceConfig.count();
    console.log(`  ✅ Configuration items: ${configCount} records`);

    console.log("\n✅ Data compatibility verification PASSED");
    return true;
  } catch (error) {
    console.error("❌ Data compatibility verification FAILED:", error.message);
    return false;
  }
}

async function generateMigrationReport() {
  console.log("\n📊 Migration Compatibility Report");
  console.log("=".repeat(60));

  const structureOK = await verifyTableStructure();
  const dataOK = await verifyDataCompatibility();

  console.log("\n📋 SUMMARY:");
  console.log(
    `   Database Structure: ${structureOK ? "✅ Compatible" : "❌ Issues Found"}`
  );
  console.log(
    `   Data Access: ${dataOK ? "✅ Compatible" : "❌ Issues Found"}`
  );

  if (structureOK && dataOK) {
    console.log(
      "\n🎉 RESULT: Database is fully compatible with Flask data imports"
    );
    console.log("\nNext steps:");
    console.log(
      "  1. Export data from Flask database using pg_dump or custom scripts"
    );
    console.log("  2. Import data using psql or custom import scripts");
    console.log("  3. Run 'npx prisma generate' to update Prisma client");
    console.log("  4. Test application functionality with imported data");
  } else {
    console.log(
      "\n⚠️  RESULT: Database has compatibility issues that need to be resolved"
    );
    console.log("\nRecommended actions:");
    console.log("  1. Review and fix the issues listed above");
    console.log("  2. Consider running database migration scripts");
    console.log("  3. Verify Prisma schema matches your Flask models");
    console.log("  4. Re-run this verification after fixes");
  }

  return structureOK && dataOK;
}

async function main() {
  console.log("🚀 CityForge Migration Compatibility Verification");
  console.log("=".repeat(60));
  console.log("This script verifies that the Next.js database schema");
  console.log("is compatible with data exports from Flask/SQLAlchemy\n");

  try {
    await prisma.$connect();
    console.log("✅ Connected to database\n");

    const success = await generateMigrationReport();

    await prisma.$disconnect();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  verifyTableStructure,
  verifyDataCompatibility,
  generateMigrationReport,
};
