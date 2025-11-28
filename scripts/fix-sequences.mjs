#!/usr/bin/env node

/**
 * Fix Database Sequences
 *
 * This script resets all PostgreSQL sequences to match the maximum ID values
 * in their respective tables, preventing unique constraint violations.
 *
 * Usage:
 *   npm run fix-sequences
 *   OR
 *   node scripts/fix-sequences.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixSequences() {
  console.log("🔄 Resetting database sequences...\n");

  try {
    // Get all sequences in the public schema
    const sequences = await prisma.$queryRaw`
      SELECT sequence_name
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
    `;

    let resetCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const seq of sequences) {
      try {
        // Extract table name from sequence name (format: tablename_id_seq)
        const tableName = seq.sequence_name.replace(/_id_seq$/, "");

        // Get max ID from the table
        const result = await prisma.$queryRawUnsafe(`
          SELECT MAX(id) as max_id FROM ${tableName}
        `);

        if (result.length > 0) {
          const maxId = result[0].max_id || 0;

          // Set sequence to max_id with is_called=true
          // This means the next nextval() will return max_id + 1
          await prisma.$queryRawUnsafe(`
            SELECT setval('${seq.sequence_name}', ${maxId}, true)
          `);

          console.log(
            `  ✅ ${seq.sequence_name.padEnd(40)} max=${maxId}, next=${maxId + 1}`
          );
          resetCount++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `  ❌ ${seq.sequence_name.padEnd(40)} ERROR: ${errorMsg}`
        );
        errors.push({ sequence: seq.sequence_name, error: errorMsg });
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(
      `✅ Sequence reset complete: ${resetCount} updated, ${errorCount} errors`
    );
    console.log("=".repeat(60));

    if (errorCount > 0) {
      console.warn("\n⚠️  WARNING: Some sequences could not be reset:");
      errors.forEach(({ sequence, error }) => {
        console.warn(`   - ${sequence}: ${error}`);
      });
      console.warn(
        "\n   These errors may indicate missing tables or other database issues."
      );
      console.warn(
        "   Review the errors above and consult docs/DATABASE_SEQUENCE_TROUBLESHOOTING.md\n"
      );
      process.exit(1);
    } else {
      console.log("\n🎉 All sequences successfully reset!");
      console.log(
        "   Your database is now ready for new inserts without conflicts.\n"
      );
    }
  } catch (error) {
    console.error(
      "\n❌ Fatal error resetting sequences:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log("🚀 Database Sequence Fixer");
  console.log("=".repeat(60));
  console.log("This script will reset all sequences to match max ID values");
  console.log("=".repeat(60) + "\n");

  try {
    await prisma.$connect();
    console.log("✅ Connected to database\n");
    await fixSequences();
  } catch (error) {
    console.error(
      "❌ Failed to connect to database:",
      error instanceof Error ? error.message : error
    );
    console.error("\nMake sure your DATABASE_URL environment variable is set.");
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fixSequences };
