#!/usr/bin/env node

/**
 * Convert Flask Export Format to Admin API Format
 *
 * This script converts the separate JSON files created by flask-data-export.mjs
 * into the single consolidated format expected by the admin data import API.
 *
 * Usage:
 *   node convert-flask-export-to-admin-format.mjs --input ./flask-export --output ./admin-import-data.json
 */

import { promises as fs } from "fs";
import { resolve } from "path";

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

// Command line argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];
    options[key] = value;
  }

  return options;
}

// Mapping from Flask table names to Admin API model names
const TABLE_TO_MODEL_MAPPING = {
  users: "User",
  tags: "Tag",
  resource_categories: "ResourceCategory",
  cards: "Card",
  card_tags: "card_tags", // Keep snake_case for junction table
  card_submissions: "CardSubmission",
  card_modifications: "CardModification",
  quick_access_items: "QuickAccessItem",
  resource_items: "ResourceItem",
  resource_config: "ResourceConfig",
  reviews: "Review",
  forum_categories: "ForumCategory",
  forum_category_requests: "ForumCategoryRequest",
  forum_threads: "ForumThread",
  forum_posts: "ForumPost",
  forum_reports: "ForumReport",
  help_wanted_posts: "HelpWantedPost",
  help_wanted_comments: "HelpWantedComment",
  help_wanted_reports: "HelpWantedReport",
  support_tickets: "SupportTicket",
  support_ticket_messages: "SupportTicketMessage",
  indexing_jobs: "IndexingJob",
  token_blacklist: "TokenBlacklist",
  alembic_version: "alembic_version",
};

// Field name transformations from snake_case to camelCase for specific models
const FIELD_TRANSFORMATIONS = {
  User: {
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
  Card: {
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
  Tag: {
    created_date: "createdDate",
  },
  ResourceCategory: {
    display_order: "displayOrder",
    created_date: "createdDate",
  },
  ResourceItem: {
    category_id: "categoryId",
    display_order: "displayOrder",
    is_active: "isActive",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  ResourceConfig: {
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
  QuickAccessItem: {
    display_order: "displayOrder",
    is_active: "isActive",
    created_date: "createdDate",
  },
  CardSubmission: {
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
  CardModification: {
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
  Review: {
    card_id: "cardId",
    user_id: "userId",
    created_date: "createdDate",
    updated_date: "updatedDate",
  },
};

function transformRecord(modelName, record) {
  const transformations = FIELD_TRANSFORMATIONS[modelName] || {};
  const transformed = {};

  for (const [key, value] of Object.entries(record)) {
    const newKey = transformations[key] || key;

    // Transform boolean strings to actual booleans
    if (
      typeof value === "string" &&
      (value === "true" || value === "false" || value === "t" || value === "f")
    ) {
      transformed[newKey] = value === "true" || value === "t";
    }
    // Transform date strings to proper date format
    else if (
      key.includes("date") ||
      (key.includes("_at") && value && typeof value === "string")
    ) {
      transformed[newKey] = new Date(value).toISOString();
    } else {
      transformed[newKey] = value;
    }
  }

  return transformed;
}

async function loadFlaskTable(inputDir, tableName) {
  try {
    const fileName = `${tableName}.json`;
    validateFilename(fileName);
    const filePath = validatePath(inputDir, fileName);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const tableData = JSON.parse(fileContent);

    console.log(`  📁 Loaded ${tableName}: ${tableData.length} rows`);
    return tableData;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`  ⚠️  File not found: ${tableName}.json, skipping`);
      return null;
    }
    throw error;
  }
}

async function convertFlaskExportToAdminFormat(inputDir, outputFile) {
  const adminData = {};
  let totalRecords = 0;

  console.log(`📁 Loading Flask export from: ${inputDir}`);

  // Load export metadata if available
  let metadata = null;
  try {
    const metadataPath = validatePath(inputDir, "export-metadata.json");
    const metadataContent = await fs.readFile(metadataPath, "utf-8");
    metadata = JSON.parse(metadataContent);
    console.log(`📋 Export metadata found from ${metadata.exportDate}`);
  } catch (error) {
    console.log("⚠️  No export metadata found, proceeding without it");
  }

  // Process each table
  for (const [tableName, modelName] of Object.entries(TABLE_TO_MODEL_MAPPING)) {
    const tableData = await loadFlaskTable(inputDir, tableName);

    if (tableData && Array.isArray(tableData) && tableData.length > 0) {
      // Transform records for admin API format
      const transformedRecords = tableData.map((record) =>
        transformRecord(modelName, record)
      );
      adminData[modelName] = transformedRecords;
      totalRecords += transformedRecords.length;
      console.log(
        `  ✅ Converted ${tableName} → ${modelName}: ${transformedRecords.length} records`
      );
    }
  }

  // Write the converted data in the exact format expected by admin import API
  // The admin API expects each model as a direct property with array values
  const outputData = adminData;

  await fs.writeFile(outputFile, JSON.stringify(outputData, null, 2));

  console.log(`\n✅ Conversion completed successfully!`);
  console.log(`   Input: ${inputDir}`);
  console.log(`   Output: ${outputFile}`);
  console.log(`   Total models: ${Object.keys(adminData).length}`);
  console.log(`   Total records: ${totalRecords}`);
  console.log(`\n📋 Models included:`);

  for (const [modelName, records] of Object.entries(adminData)) {
    console.log(`   ${modelName}: ${records.length} records`);
  }

  return outputData;
}

async function main() {
  console.log("🔄 Flask Export → Admin Format Converter");
  console.log("=".repeat(50));

  const options = parseArgs();

  if (!options.input) {
    console.error("❌ Missing required parameter: --input");
    console.error("\nUsage:");
    console.error(
      "  node convert-flask-export-to-admin-format.mjs --input ./flask-export --output ./admin-import-data.json"
    );
    console.error("\nParameters:");
    console.error(
      "  --input <dir>    Directory containing Flask export files (users.json, cards.json, etc.)"
    );
    console.error(
      "  --output <file>  Output file for admin API format (default: ./admin-import-data.json)"
    );
    process.exit(1);
  }

  const inputDir = options.input;
  const outputFile = options.output || "./admin-import-data.json";

  console.log(`Input directory: ${inputDir}`);
  console.log(`Output file: ${outputFile}\n`);

  try {
    // Check if input directory exists
    await fs.access(inputDir);

    await convertFlaskExportToAdminFormat(inputDir, outputFile);

    console.log("\n📋 Next steps:");
    console.log("  1. Review the generated file:");
    console.log(`     ${outputFile}`);
    console.log("  2. Use the admin data import interface to upload this file");
    console.log(
      "  3. Make sure to type 'DELETE ALL DATA' to confirm the destructive import"
    );
    console.log("  4. Verify data integrity after import");
  } catch (error) {
    console.error("❌ Conversion failed:", error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { convertFlaskExportToAdminFormat };
