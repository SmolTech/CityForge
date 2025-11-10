#!/usr/bin/env node

/**
 * Script to promote a user to admin role
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function promoteToAdmin() {
  try {
    await prisma.$connect();
    console.log("Connected to database");

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: "admin@cityforge.local" },
    });

    if (!user) {
      console.error("❌ User with email admin@cityforge.local not found");
      process.exit(1);
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

promoteToAdmin();
