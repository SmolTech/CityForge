#!/usr/bin/env node

/**
 * Flask Data Import Utility
 *
 * This script imports data exported from a Flask/SQLAlchemy database
 * into the new Next.js/Prisma system while preserving data integrity
 * and foreign key relationships.
 *
 * Usage:
 *   node flask-data-import.mjs --input ./export [--dry-run] [--skip-existing]
 */

import { promises as fs } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// Security helper function to validate paths and prevent traversal
function validatePath(basePath, userPath) {
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const resolvedBase = resolve(basePath);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const resolvedUser = resolve(basePath, userPath);

  // Ensure the resolved user path is within the base directory
  if (
    !resolvedUser.startsWith(resolvedBase + "/") &&
    resolvedUser !== resolvedBase
  ) {
    throw new Error(`Path traversal detected: ${userPath}`);
  }

  return resolvedUser;
}

// Safe filename validation
function validateFilename(filename) {
  const safePattern = /^[a-zA-Z0-9_-]+\.json$/;
  if (!safePattern.test(filename)) {
    throw new Error(`Invalid filename: ${filename}`);
  }
  return filename;
}

const prisma = new PrismaClient();

// Convert kebab-case to camelCase
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Command line argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const flagName = arg.replace(/^--/, "");
      const camelCaseName = toCamelCase(flagName);

      if (args[i + 1] && !args[i + 1].startsWith("--")) {
        // Flag with value
        options[camelCaseName] = args[i + 1];
        i++; // Skip next argument since we consumed it
      } else {
        // Boolean flag
        options[camelCaseName] = true;
      }
    }
  }

  return options;
}

// Import order: tables with no dependencies first
const IMPORT_ORDER = [
  "users",
  "tags",
  "resource_categories",
  "resource_config",
  "quick_access_items",
  "cards",
  "card_tags",
  "resource_items",
  "card_submissions",
  "card_modifications",
  "reviews",
  "forum_categories",
  "forum_category_requests",
  "forum_threads",
  "forum_posts",
  "forum_reports",
  "help_wanted_posts",
  "help_wanted_comments",
  "help_wanted_reports",
  "support_tickets",
  "support_ticket_messages",
  "indexing_jobs",
  "token_blacklist",
];

// Field transformations for data compatibility
const FIELD_TRANSFORMATIONS = {
  // Convert boolean strings to actual booleans
  booleanFields: {
    users: ["is_active", "email_verified"],
    cards: ["featured", "approved"],
    resource_items: ["is_active"],
    quick_access_items: ["is_active"],
    forum_categories: ["is_active"],
    forum_threads: ["is_pinned", "is_locked"],
    forum_posts: ["is_first_post"],
  },

  // Convert date strings to Date objects
  dateFields: {
    users: ["created_date"],
    cards: ["created_date", "updated_date", "approved_date"],
    tags: ["created_date"],
    resource_categories: ["created_date"],
    resource_config: ["created_date", "updated_date"],
    quick_access_items: ["created_date"],
    resource_items: ["created_date", "updated_date"],
    card_submissions: ["created_date", "reviewed_date"],
    card_modifications: ["created_date", "reviewed_date"],
    reviews: ["created_date", "updated_date"],
    forum_categories: ["created_date", "updated_date"],
    forum_category_requests: ["created_date", "reviewed_date"],
    forum_threads: ["created_date", "updated_date"],
    forum_posts: ["created_date", "updated_date", "edited_date"],
    forum_reports: ["created_date", "resolved_date"],
    help_wanted_posts: ["created_date", "updated_date"],
    help_wanted_comments: ["created_date", "updated_date"],
    help_wanted_reports: ["created_date", "resolved_date"],
    support_tickets: ["created_date", "updated_date"],
    support_ticket_messages: ["created_date"],
    indexing_jobs: ["started_at", "completed_at"],
    token_blacklist: ["revoked_at", "expires_at"],
  },
};

// Field name conversions from snake_case (Flask/DB) to camelCase (Prisma)
const FIELD_NAME_MAPPINGS = {
  users: {
    password_hash: "passwordHash",
    first_name: "firstName",
    last_name: "lastName",
    is_active: "isActive",
    created_date: "createdDate",
    last_login: "lastLogin",
    is_supporter_flag: "isSupporterFlag",
    email_verified: "emailVerified",
    email_verification_token: "emailVerificationToken",
    email_verification_sent_at: "emailVerificationSentAt",
  },
  cards: {
    website_url: "websiteUrl",
    phone_number: "phoneNumber",
    contact_name: "contactName",
    logo_url: "logoUrl",
    additional_images: "additionalImages",
    created_by: "createdBy",
    approved_by: "approvedBy",
    created_date: "createdDate",
    updated_date: "updatedDate",
    approved_date: "approvedDate",
  },
  tags: {
    created_date: "createdDate",
  },
  resource_categories: {
    display_order: "displayOrder",
    created_date: "createdDate",
  },
  resource_items: {
    category_id: "categoryId",
    display_order: "displayOrder",
    is_active: "isActive",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  resource_config: {
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  quick_access_items: {
    display_order: "displayOrder",
    is_active: "isActive",
    created_date: "createdDate",
  },
  card_submissions: {
    website_url: "websiteUrl",
    phone_number: "phoneNumber",
    contact_name: "contactName",
    logo_url: "logoUrl",
    tags_text: "tagsText",
    submitted_by: "submittedBy",
    reviewed_by: "reviewedBy",
    created_date: "createdDate",
    reviewed_date: "reviewedDate",
    admin_notes: "adminNotes",
  },
  card_modifications: {
    card_id: "cardId",
    website_url: "websiteUrl",
    phone_number: "phoneNumber",
    contact_name: "contactName",
    logo_url: "logoUrl",
    additional_images: "additionalImages",
    tags_text: "tagsText",
    submitted_by: "submittedBy",
    reviewed_by: "reviewedBy",
    created_date: "createdDate",
    reviewed_date: "reviewedDate",
    admin_notes: "adminNotes",
  },
  reviews: {
    card_id: "cardId",
    user_id: "userId",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  forum_categories: {
    display_order: "displayOrder",
    is_active: "isActive",
    created_by: "createdBy",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  forum_category_requests: {
    requested_by: "requestedBy",
    reviewed_by: "reviewedBy",
    created_date: "createdDate",
    reviewed_date: "reviewedDate",
    admin_notes: "adminNotes",
  },
  forum_threads: {
    category_id: "categoryId",
    is_pinned: "isPinned",
    is_locked: "isLocked",
    report_count: "reportCount",
    created_by: "createdBy",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  forum_posts: {
    thread_id: "threadId",
    is_first_post: "isFirstPost",
    report_count: "reportCount",
    created_by: "createdBy",
    created_date: "createdDate",
    updated_date: "updatedDate",
    edited_date: "editedDate",
  },
  forum_reports: {
    reported_content_type: "reportedContentType",
    reported_content_id: "reportedContentId",
    reported_by: "reportedBy",
    resolved_by: "resolvedBy",
    created_date: "createdDate",
    resolved_date: "resolvedDate",
    resolution_action: "resolutionAction",
  },
  help_wanted_posts: {
    contact_info: "contactInfo",
    created_by: "createdBy",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  help_wanted_comments: {
    post_id: "postId",
    created_by: "createdBy",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  help_wanted_reports: {
    reported_content_type: "reportedContentType",
    reported_content_id: "reportedContentId",
    reported_by: "reportedBy",
    resolved_by: "resolvedBy",
    created_date: "createdDate",
    resolved_date: "resolvedDate",
    resolution_action: "resolutionAction",
  },
  support_tickets: {
    user_id: "userId",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  support_ticket_messages: {
    ticket_id: "ticketId",
    user_id: "userId",
    is_admin_reply: "isAdminReply",
    created_date: "createdDate",
  },
  indexing_jobs: {
    resource_id: "resourceId",
    pages_indexed: "pagesIndexed",
    total_pages: "totalPages",
    last_error: "lastError",
    started_at: "startedAt",
    completed_at: "completedAt",
    retry_count: "retryCount",
  },
  token_blacklist: {
    jti_hash: "jtiHash",
    revoked_at: "revokedAt",
    expires_at: "expiresAt",
  },
  card_tags: {
    card_id: "card_id", // Keep snake_case for join table
    tag_id: "tag_id", // Keep snake_case for join table
  },
};

function transformFieldValue(tableName, fieldName, value) {
  if (value === null || value === undefined) {
    return null;
  }

  // Boolean transformations
  const boolFields = FIELD_TRANSFORMATIONS.booleanFields[tableName] || [];
  if (boolFields.includes(fieldName)) {
    if (typeof value === "string") {
      return value.toLowerCase() === "true" || value === "1" || value === "t";
    }
    return Boolean(value);
  }

  // Date transformations
  const dateFields = FIELD_TRANSFORMATIONS.dateFields[tableName] || [];
  if (dateFields.includes(fieldName)) {
    if (typeof value === "string") {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    return value instanceof Date ? value : new Date(value);
  }

  return value;
}

function transformRowData(tableName, row) {
  const transformedRow = {};
  const fieldMappings = FIELD_NAME_MAPPINGS[tableName] || {};

  for (const [originalFieldName, value] of Object.entries(row)) {
    // Apply field name mapping (snake_case to camelCase)
    const fieldName = fieldMappings[originalFieldName] || originalFieldName;

    // Apply value transformation
    transformedRow[fieldName] = transformFieldValue(
      tableName,
      originalFieldName, // Use original field name for transformation lookup
      value
    );
  }

  return transformedRow;
}

async function loadTableData(inputDir, tableName) {
  try {
    const fileName = `${tableName}.json`;
    validateFilename(fileName);
    const filePath = validatePath(inputDir, fileName);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const tableData = JSON.parse(fileContent);

    console.log(`📁 Loaded ${tableName}: ${tableData.rowCount} rows`);
    return tableData;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`⚠️  File not found: ${tableName}.json, skipping`);
      return null;
    }
    throw error;
  }
}

function reverseTransformFieldNames(tableName, transformedRecord) {
  const reversedRecord = {};
  const fieldMappings = FIELD_NAME_MAPPINGS[tableName] || {};

  // Create reverse mapping (camelCase -> snake_case)
  const reverseMapping = {};
  for (const [originalName, transformedName] of Object.entries(fieldMappings)) {
    reverseMapping[transformedName] = originalName;
  }

  // Convert transformed field names back to original database column names
  for (const [fieldName, value] of Object.entries(transformedRecord)) {
    const originalFieldName = reverseMapping[fieldName] || fieldName;
    reversedRecord[originalFieldName] = value;
  }

  return reversedRecord;
}

async function importRecordWithRawSQL(tableName, record) {
  // Convert transformed field names back to database column names
  const dbRecord = reverseTransformFieldNames(tableName, record);

  // Build SQL INSERT statement
  const columns = Object.keys(dbRecord);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values = columns.map((col) => {
    const value = dbRecord[col];
    // Handle null values
    if (value === null || value === undefined) return null;
    // Handle dates
    if (value instanceof Date) return value;
    // Handle booleans
    if (typeof value === "boolean") return value;
    return value;
  });

  const sql = `
    INSERT INTO ${tableName} (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
  `;

  // Use $queryRawUnsafe with parameters
  await prisma.$queryRawUnsafe(sql, ...values);
}

async function importTableData(tableName, tableData, options = {}) {
  if (!tableData || !tableData.data || tableData.data.length === 0) {
    console.log(`  📝 No data to import for ${tableName}`);
    return { imported: 0, skipped: 0, errors: 0 };
  }

  const stats = { imported: 0, skipped: 0, errors: 0 };

  console.log(`📥 Importing ${tableName} (${tableData.data.length} rows)...`);

  for (const row of tableData.data) {
    try {
      // Transform data for compatibility
      const transformedRow = transformRowData(tableName, row);

      // Check if record already exists (for skip-existing mode)
      if (options.skipExisting && transformedRow.id) {
        const existing = await prisma[getModelName(tableName)].findUnique({
          where: { id: transformedRow.id },
        });

        if (existing) {
          if (options.dryRun) {
            console.log(
              `  ⏩ [DRY RUN] Would skip existing record: ${tableName}.id=${transformedRow.id}`
            );
          } else {
            console.log(
              `  ⏩ Skipping existing record: ${tableName}.id=${transformedRow.id}`
            );
          }
          stats.skipped++;
          continue;
        }
      }

      if (options.dryRun) {
        console.log(`  🔍 [DRY RUN] Would import:`, transformedRow);
        stats.imported++;
        continue;
      }

      // Import the record using raw SQL to preserve IDs
      await importRecordWithRawSQL(tableName, transformedRow);

      stats.imported++;

      if (stats.imported % 100 === 0) {
        console.log(
          `    ✅ Imported ${stats.imported}/${tableData.data.length} records...`
        );
      }
    } catch (error) {
      console.error(`  ❌ Error importing record:`, error.message);
      if (options.verbose) {
        console.error(`     Row data:`, row);
      }
      stats.errors++;

      // Stop on first error unless in lenient mode
      if (!options.lenient) {
        throw new Error(`Failed to import ${tableName}: ${error.message}`);
      }
    }
  }

  console.log(
    `  ✅ Completed ${tableName}: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`
  );
  return stats;
}

// Map table names to Prisma model names
function getModelName(tableName) {
  const modelMap = {
    users: "user",
    cards: "card",
    tags: "tag",
    card_tags: "card_tags",
    card_submissions: "cardSubmission",
    card_modifications: "cardModification",
    resource_categories: "resourceCategory",
    resource_items: "resourceItem",
    resource_config: "resourceConfig",
    quick_access_items: "quickAccessItem",
    reviews: "review",
    forum_categories: "forumCategory",
    forum_category_requests: "forumCategoryRequest",
    forum_threads: "forumThread",
    forum_posts: "forumPost",
    forum_reports: "forumReport",
    help_wanted_posts: "helpWantedPost",
    help_wanted_comments: "helpWantedComment",
    help_wanted_reports: "helpWantedReport",
    support_tickets: "supportTicket",
    support_ticket_messages: "supportTicketMessage",
    indexing_jobs: "indexingJob",
    token_blacklist: "tokenBlacklist",
  };

  return modelMap[tableName] || tableName;
}

async function resetSequences() {
  console.log("🔄 Resetting database sequences...");

  // Get all sequences and reset them to match imported data
  const sequences = await prisma.$queryRaw`
    SELECT sequence_name, sequence_schema
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `;

  let resetCount = 0;
  let errorCount = 0;

  for (const seq of sequences) {
    try {
      // Extract table name from sequence name (assumes format: tablename_id_seq)
      const tableName = seq.sequence_name.replace(/_id_seq$/, "");

      // Get max ID from the table
      const result = await prisma.$queryRawUnsafe(`
        SELECT MAX(id) as max_id FROM ${tableName}
      `);

      if (result.length > 0) {
        const maxId = result[0].max_id || 0;
        // Set sequence to max_id with is_called=true, so next value will be max_id+1
        await prisma.$queryRawUnsafe(`
          SELECT setval('${seq.sequence_name}', ${maxId}, true)
        `);
        console.log(
          `  ✅ Reset ${seq.sequence_name} to ${maxId} (next value: ${maxId + 1})`
        );
        resetCount++;
      }
    } catch (error) {
      console.warn(
        `  ⚠️  Could not reset sequence ${seq.sequence_name}: ${error.message}`
      );
      errorCount++;
    }
  }

  console.log(
    `\n✅ Sequence reset complete: ${resetCount} sequences updated, ${errorCount} errors`
  );

  // Warn if there were errors
  if (errorCount > 0) {
    console.warn(
      `\n⚠️  WARNING: ${errorCount} sequences could not be reset. This may cause unique constraint errors.`
    );
    console.warn(
      "   Run 'npm run fix-sequences' or see docs/DATABASE_SEQUENCE_TROUBLESHOOTING.md"
    );
  }
}

async function validateImport() {
  console.log("✅ Validating imported data...");

  try {
    // Check basic counts
    const counts = {};
    for (const tableName of IMPORT_ORDER) {
      try {
        const modelName = getModelName(tableName);
        if (prisma[modelName]) {
          counts[tableName] = await prisma[modelName].count();
        }
      } catch (error) {
        console.warn(`  ⚠️  Could not count ${tableName}: ${error.message}`);
      }
    }

    console.log("\n📊 Import Summary:");
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${table}: ${count} records`);
    }

    // Test critical relationships
    console.log("\n🔗 Validating relationships:");

    const cardsWithUsers = await prisma.card.count({
      where: { createdBy: { not: null } },
    });
    console.log(`  Cards with valid creators: ${cardsWithUsers}`);

    const cardTagRelations = await prisma.card_tags.count();
    console.log(`  Card-tag relationships: ${cardTagRelations}`);

    console.log("\n✅ Validation completed successfully");
    return true;
  } catch (error) {
    console.error("❌ Validation failed:", error.message);
    return false;
  }
}

async function importFlaskData(inputDir, options = {}) {
  const startTime = Date.now();
  const importStats = {};

  console.log(`📁 Loading export metadata...`);

  try {
    const metadataPath = validatePath(inputDir, "export-metadata.json");
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

    console.log(`📋 Export Info:`);
    console.log(`  Export date: ${metadata.exportDate}`);
    console.log(`  Total tables: ${metadata.totalTables}`);
    console.log(`  Total rows: ${metadata.totalRows}`);

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN MODE - No data will be modified\n");
    }
  } catch (error) {
    console.warn("⚠️  Could not load metadata:", error.message);
  }

  // Import tables in dependency order
  for (const tableName of IMPORT_ORDER) {
    try {
      const tableData = await loadTableData(inputDir, tableName);
      if (tableData) {
        importStats[tableName] = await importTableData(
          tableName,
          tableData,
          options
        );
      }
    } catch (error) {
      console.error("❌ Failed to import table:", tableName, error.message);

      if (!options.lenient) {
        throw error;
      }

      importStats[tableName] = { imported: 0, skipped: 0, errors: 1 };
    }
  }

  // Reset sequences (only in non-dry-run mode)
  if (!options.dryRun) {
    await resetSequences();
  }

  // Validate import
  if (!options.dryRun) {
    await validateImport();
  }

  // Summary
  const totalStats = Object.values(importStats).reduce(
    (acc, stats) => ({
      imported: acc.imported + stats.imported,
      skipped: acc.skipped + stats.skipped,
      errors: acc.errors + stats.errors,
    }),
    { imported: 0, skipped: 0, errors: 0 }
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n🎉 Import completed in ${duration}s`);
  console.log(`   Imported: ${totalStats.imported} records`);
  console.log(`   Skipped: ${totalStats.skipped} records`);
  console.log(`   Errors: ${totalStats.errors} records`);

  if (options.dryRun) {
    console.log("\n🔍 This was a dry run - no data was actually imported");
    console.log("   Remove --dry-run flag to perform the actual import");
  }

  return totalStats;
}

async function main() {
  console.log("🚀 Flask Data Import Utility");
  console.log("=".repeat(50));

  const options = parseArgs();

  if (!options.input) {
    console.error("❌ Missing required parameter: --input");
    console.error("\nUsage:");
    console.error("  node flask-data-import.mjs --input ./export [options]");
    console.error("\nOptions:");
    console.error(
      "  --input <dir>       Directory containing exported data files"
    );
    console.error(
      "  --dry-run          Show what would be imported without making changes"
    );
    console.error(
      "  --skip-existing    Skip records that already exist (by ID)"
    );
    console.error(
      "  --lenient          Continue on errors instead of stopping"
    );
    console.error("  --verbose          Show detailed error information");
    process.exit(1);
  }

  const inputDir = options.input;

  console.log(`Input directory: ${inputDir}`);
  console.log(`Options: ${JSON.stringify(options)}\n`);

  try {
    await prisma.$connect();
    console.log("✅ Connected to database\n");

    // Check if input directory exists
    try {
      await fs.access(inputDir);
    } catch {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }

    const stats = await importFlaskData(inputDir, options);

    if (stats.errors > 0 && !options.lenient) {
      console.error(`\n❌ Import completed with ${stats.errors} errors`);
      process.exit(1);
    }

    console.log("\n📋 Next steps:");
    console.log("  1. Review the import results above");
    console.log("  2. Test application functionality with imported data");
    console.log("  3. Run 'npx prisma generate' if schema was modified");
    console.log("  4. Consider running data validation scripts");
  } catch (error) {
    console.error("❌ Import failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importFlaskData };
