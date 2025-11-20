#!/usr/bin/env node

/**
 * Fix User ID Sequence
 *
 * This script fixes the auto-increment sequence for the User table when it
 * gets out of sync with the actual data, causing "Unique constraint failed"
 * errors during user registration.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixUserIdSequence() {
  try {
    console.log("Checking User table ID sequence...\n");

    // Get the maximum user ID
    const maxUser = await prisma.$queryRaw`
      SELECT MAX(id) as max_id FROM users
    `;
    const maxId = maxUser[0]?.max_id || 0;
    console.log(`Maximum user ID in database: ${maxId}`);

    // Get the current sequence value
    const currentSeq = await prisma.$queryRaw`
      SELECT last_value FROM users_id_seq
    `;
    const currentValue = Number(currentSeq[0]?.last_value || 0);
    console.log(`Current sequence value: ${currentValue}`);

    // Check if sequence needs fixing
    if (currentValue <= maxId) {
      console.log(
        `\n⚠️  Sequence is out of sync! (${currentValue} <= ${maxId})`
      );
      console.log(`Setting sequence to ${maxId + 1}...\n`);

      // Reset the sequence to max_id + 1
      await prisma.$executeRaw`
        SELECT setval('"users_id_seq"', ${maxId + 1}, false)
      `;

      // Verify the fix
      const newSeq = await prisma.$queryRaw`
        SELECT last_value FROM users_id_seq
      `;
      const newValue = Number(newSeq[0]?.last_value || 0);
      console.log(`✅ Sequence updated to: ${newValue}`);
      console.log(
        `   Next user ID will be: ${newValue} (note: setval with false means next call will return this value)`
      );
    } else {
      console.log("\n✅ Sequence is already correct!");
      console.log(`   Next user ID will be: ${currentValue + 1}`);
    }

    console.log("\n✨ Done!");
  } catch (error) {
    console.error("\n❌ Error fixing sequence:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserIdSequence();
