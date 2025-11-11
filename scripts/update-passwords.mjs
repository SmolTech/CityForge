#!/usr/bin/env node

/**
 * Update password hashes for test users
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updatePasswords() {
  try {
    await prisma.$connect();
    console.log("Connected to database");

    const newPasswordHash =
      "$2b$12$nvRN7WaKlTM9ZnnyloZ/b.q2jtEicknqqFiiVsvUWoo3l2wBB1Dgu"; // "testpassword"

    // Update test user
    await prisma.user.update({
      where: { email: "test@example.com" },
      data: { passwordHash: newPasswordHash },
    });
    console.log("Updated test user password");

    // Update admin user
    await prisma.user.update({
      where: { email: "admin@example.com" },
      data: { passwordHash: newPasswordHash },
    });
    console.log("Updated admin user password");

    await prisma.$disconnect();
    console.log("Password update completed");
  } catch (error) {
    console.error("Error updating passwords:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

updatePasswords();
