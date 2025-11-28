#!/usr/bin/env node

/**
 * Database Sequence Diagnostic and Fix Tool
 *
 * This script diagnoses and fixes sequence synchronization issues
 * that cause "Unique constraint failed on the fields: (`id`)" errors.
 *
 * Usage:
 *   node scripts/fix-database-sequences.mjs
 *   node scripts/fix-database-sequences.mjs --table=cards
 *   node scripts/fix-database-sequences.mjs --check-only
 */

import { PrismaClient, Prisma } from "@prisma/client";

// Parse command line arguments
const args = process.argv.slice(2);
const specificTableArg = args.find((arg) => arg.startsWith("--table"));
const specificTable = specificTableArg ? specificTableArg.split("=")[1] : null;
const checkOnly = args.includes("--check-only");

async function fixSequenceForTable(prisma, tableName, modelName) {
  try {
    console.log(`🔍 Checking ${tableName} sequence...`);

    const count = await prisma[modelName].count();
    if (count === 0) {
      console.log(`   ✅ ${tableName}: Table empty, no sequence issues\n`);
      return { table: tableName, status: "empty", fixed: false };
    }

    const maxResult = await prisma[modelName].aggregate({
      _max: { id: true },
    });
    const maxId = maxResult._max.id;

    // Get current sequence value using Prisma.raw for safe SQL injection prevention
    const seqResult = await prisma.$queryRaw(
      Prisma.sql`SELECT last_value, is_called FROM ${Prisma.raw(tableName + "_id_seq")}`
    );

    const lastValue = Number(seqResult[0].last_value);
    const isCalled = seqResult[0].is_called;

    // Calculate the next value that would be returned
    const nextValue = isCalled ? lastValue + 1 : lastValue;

    console.log(`   Records: ${count}, Max ID: ${maxId}`);
    console.log(`   Sequence last_value: ${lastValue}, is_called: ${isCalled}`);
    console.log(`   Next ID would be: ${nextValue}`);

    if (nextValue <= maxId) {
      console.log(
        `   ⚠️  CONFLICT: Next ID (${nextValue}) <= Max ID (${maxId})`
      );

      if (checkOnly) {
        console.log(`   🔧 Would fix: Set sequence to ${maxId + 1}`);
        return {
          table: tableName,
          status: "needs_fix",
          maxId,
          nextValue,
          fixed: false,
        };
      } else {
        console.log(`   🔧 Fixing: Setting sequence to ${maxId + 1}...`);

        // Fix the sequence using Prisma.raw for safe SQL
        await prisma.$executeRaw(
          Prisma.sql`SELECT setval(${Prisma.raw("'" + tableName + "_id_seq'")}, ${maxId + 1}, false)`
        );

        // Verify the fix
        const verifyResult = await prisma.$queryRaw(
          Prisma.sql`SELECT last_value, is_called FROM ${Prisma.raw(tableName + "_id_seq")}`
        );

        console.log(
          `   ✅ Fixed: Sequence set to ${verifyResult[0].last_value} (is_called: ${verifyResult[0].is_called})`
        );
        return {
          table: tableName,
          status: "fixed",
          maxId,
          nextValue: maxId + 1,
          fixed: true,
        };
      }
    } else {
      console.log(`   ✅ OK: Next ID (${nextValue}) > Max ID (${maxId})`);
      return { table: tableName, status: "ok", maxId, nextValue, fixed: false };
    }
  } catch (error) {
    console.log(`   ❌ Error checking ${tableName}: ${error.message}`);
    return {
      table: tableName,
      status: "error",
      error: error.message,
      fixed: false,
    };
  }
}

async function diagnoseAndFixSequences() {
  const prisma = new PrismaClient();

  try {
    console.log("🔍 Database Sequence Diagnostic and Repair Tool");
    console.log("===============================================\n");

    if (checkOnly) {
      console.log("🔎 CHECK-ONLY MODE: Will not make any changes\n");
    }

    // Define tables to check
    const tables = [
      { name: "cards", model: "card" },
      { name: "users", model: "user" },
      { name: "tags", model: "tag" },
      { name: "card_submissions", model: "cardSubmission" },
      { name: "card_modifications", model: "cardModification" },
      { name: "reviews", model: "review" },
      { name: "forum_categories", model: "forumCategory" },
      { name: "forum_threads", model: "forumThread" },
      { name: "forum_posts", model: "forumPost" },
      { name: "forum_category_requests", model: "forumCategoryRequest" },
      { name: "forum_reports", model: "forumReport" },
    ];

    const results = [];

    if (specificTable) {
      const table = tables.find((t) => t.name === specificTable);
      if (table) {
        console.log(`🎯 Checking specific table: ${specificTable}\n`);
        const result = await fixSequenceForTable(
          prisma,
          table.name,
          table.model
        );
        results.push(result);
      } else {
        console.log(
          `❌ Table '${specificTable}' not found in supported tables.`
        );
        console.log(
          `Supported tables: ${tables.map((t) => t.name).join(", ")}`
        );
        return;
      }
    } else {
      for (const table of tables) {
        const result = await fixSequenceForTable(
          prisma,
          table.name,
          table.model
        );
        results.push(result);
        console.log(); // Add spacing between tables
      }
    }

    // Summary
    console.log("📋 SUMMARY");
    console.log("==========");

    const fixed = results.filter((r) => r.fixed);
    const needsFix = results.filter((r) => r.status === "needs_fix");
    const errors = results.filter((r) => r.status === "error");
    const ok = results.filter((r) => r.status === "ok");
    const empty = results.filter((r) => r.status === "empty");

    if (checkOnly) {
      console.log(`✅ OK: ${ok.length} tables`);
      console.log(`📭 Empty: ${empty.length} tables`);
      console.log(`⚠️  Needs fix: ${needsFix.length} tables`);
      if (needsFix.length > 0) {
        needsFix.forEach((r) =>
          console.log(`   - ${r.table}: next=${r.nextValue}, max=${r.maxId}`)
        );
        console.log("\n🔧 Run without --check-only to apply fixes");
      }
    } else {
      console.log(`✅ OK: ${ok.length} tables`);
      console.log(`📭 Empty: ${empty.length} tables`);
      console.log(`🔧 Fixed: ${fixed.length} tables`);
      if (fixed.length > 0) {
        fixed.forEach((r) =>
          console.log(`   - ${r.table}: set to ${r.nextValue}`)
        );
      }
    }

    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length} tables`);
      errors.forEach((r) => console.log(`   - ${r.table}: ${r.error}`));
    }

    if (fixed.length > 0 || needsFix.length > 0) {
      console.log("\n💡 Tips:");
      console.log("   - Test card/user creation after fixing sequences");
      console.log("   - Avoid setting IDs explicitly in application code");
      console.log("   - Run this tool after data imports/migrations");
    }
  } catch (error) {
    console.error("❌ Fatal error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the diagnostic
diagnoseAndFixSequences()
  .then(() => {
    console.log("\n🎉 Sequence diagnostic completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  });
