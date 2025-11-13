#!/usr/bin/env node

/**
 * Flask Data Export Utility
 *
 * This script helps export data from a Flask/SQLAlchemy database
 * in a format that can be imported into the new Next.js/Prisma system.
 *
 * Usage:
 *   node flask-data-export.mjs --source-db "postgresql://user:pass@host:port/db" --output ./export
 */

import { promises as fs } from "fs";
import { resolve } from "path";
import pg from "pg";

const { Client } = pg;

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

// Tables to export in dependency order (tables with no foreign keys first)
const EXPORT_ORDER = [
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

async function exportTable(client, tableName, outputDir) {
  try {
    // Sanitize table name to prevent path traversal
    const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
    if (safeTableName !== tableName) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    // Query all data from the table
    const dataResult = await client.query(`SELECT * FROM ${safeTableName}`);
    const exportData = dataResult.rows;

    const fileName = `${safeTableName}.json`;
    validateFilename(fileName);
    const filePath = validatePath(outputDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

    // nosemgrep: javascript.express.log.console-log-express.console-log-express
    console.log("  ✅ Exported", dataResult.rowCount, "rows to", fileName);
    return dataResult.rowCount;
  } catch (error) {
    console.error("  ❌ Error exporting table:", tableName, error.message);
    return 0;
  }
}

async function exportFlaskDatabase(sourceDb, outputDir) {
  const client = new Client({ connectionString: sourceDb });

  try {
    await client.connect();
    console.log("✅ Connected to source database");

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`✅ Created output directory: ${outputDir}`);

    let totalRows = 0;
    const exportSummary = {};

    // Export each table
    for (const tableName of EXPORT_ORDER) {
      try {
        // Check if table exists
        const tableExists = await client.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = $1
          )
        `,
          [tableName]
        );

        if (tableExists.rows[0].exists) {
          const rowCount = await exportTable(client, tableName, outputDir);
          exportSummary[tableName] = rowCount;
          totalRows += rowCount;
        } else {
          console.log(`  ⚠️  Table ${tableName} does not exist, skipping`);
          exportSummary[tableName] = "TABLE_NOT_FOUND";
        }
      } catch (error) {
        console.error("  ❌ Failed to export table:", tableName, error.message);
        exportSummary[tableName] = `ERROR: ${error.message}`;
      }
    }

    // Generate export metadata
    const metadata = {
      exportDate: new Date().toISOString(),
      sourceDatabase: sourceDb.replace(/\/\/[^:]+:[^@]+@/, "//***:***@"), // Hide credentials
      totalTables: Object.keys(exportSummary).length,
      totalRows,
      tablesSummary: exportSummary,
    };

    const metadataPath = validatePath(outputDir, "export-metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`\n✅ Export completed successfully!`);
    console.log(`   Total tables: ${metadata.totalTables}`);
    console.log(`   Total rows: ${totalRows}`);
    console.log(`   Output directory: ${outputDir}`);

    return metadata;
  } catch (error) {
    console.error("❌ Export failed:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log("🚀 Flask Data Export Utility");
  console.log("=".repeat(50));

  const options = parseArgs();

  if (!options["source-db"]) {
    console.error("❌ Missing required parameter: --source-db");
    console.error("\nUsage:");
    console.error(
      '  node flask-data-export.mjs --source-db "postgresql://user:pass@host:port/db" --output ./export'
    );
    process.exit(1);
  }

  const sourceDb = options["source-db"];
  const outputDir = options.output || "./flask-export";

  console.log(
    `Source database: ${sourceDb.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`
  );
  console.log(`Output directory: ${outputDir}\n`);

  try {
    await exportFlaskDatabase(sourceDb, outputDir);

    console.log("\n📋 Next steps:");
    console.log("  1. Review the exported data files");
    console.log("  2. Run the import script: node flask-data-import.mjs");
    console.log("  3. Verify data integrity after import");
  } catch (error) {
    console.error("❌ Export failed:", error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { exportFlaskDatabase };
