#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function createTestAdmin() {
  try {
    const email = "admin@test.com";
    const password = "TestPassword123!";
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log("✅ User already exists, promoting to admin...");
      await prisma.user.update({
        where: { email },
        data: { role: "admin" },
      });
      console.log("✅ User promoted to admin successfully");
    } else {
      console.log("Creating new admin user...");
      await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          firstName: "Admin",
          lastName: "User",
          role: "admin",
          emailVerified: true,
          isActive: true,
          createdDate: new Date(),
        },
      });
      console.log("✅ Admin user created successfully");
    }

    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAdmin();
