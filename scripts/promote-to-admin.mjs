#!/usr/bin/env node

/**
 * Script to promote a user to admin role
 *
 * Usage:
 *   node scripts/promote-to-admin.mjs <email>
 *
 * Example:
 *   node scripts/promote-to-admin.mjs admin@example.com
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function promoteToAdmin(email) {
  try {
    await prisma.$connect();
    console.log("Connected to database");

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    // Check if user is already an admin
    if (user.role === "admin") {
      console.log(`ℹ️  User ${email} is already an admin`);
      console.log("- ID:", user.id);
      console.log("- Email:", user.email);
      console.log("- Name:", user.firstName, user.lastName);
      console.log("- Role:", user.role);
      await prisma.$disconnect();
      process.exit(0);
    }

    // Update user role to admin
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: "admin" },
    });

    console.log("✅ Successfully promoted user to admin:");
    console.log("- ID:", updatedUser.id);
    console.log("- Email:", updatedUser.email);
    console.log("- Name:", updatedUser.firstName, updatedUser.lastName);
    console.log("- Role:", updatedUser.role);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error promoting user:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error("❌ Error: Email address is required");
  console.error("");
  console.error("Usage:");
  console.error("  node scripts/promote-to-admin.mjs <email>");
  console.error("");
  console.error("Example:");
  console.error("  node scripts/promote-to-admin.mjs admin@example.com");
  process.exit(1);
}

promoteToAdmin(email);
