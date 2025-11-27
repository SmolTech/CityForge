#!/usr/bin/env node

/**
 * Token cleanup script using Node.js and Prisma
 * This replaces the Flask-based cleanup_expired_tokens.py script
 */

import { PrismaClient } from "@prisma/client";

async function cleanupExpiredTokens() {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log("Starting expired token cleanup...");

    // Get JWT configuration to calculate expiration time
    const JWT_EXPIRY_HOURS = 24; // Default JWT expiry time
    const expiredBefore = new Date();
    expiredBefore.setHours(expiredBefore.getHours() - JWT_EXPIRY_HOURS);

    // Delete expired tokens from the blacklist
    const result = await prisma.tokenBlacklist.deleteMany({
      where: {
        createdAt: {
          lt: expiredBefore,
        },
      },
    });

    console.log(
      `Cleaned up ${result.count} expired tokens from blacklist (expired before ${expiredBefore.toISOString()})`
    );

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning up expired tokens:", error);

    await prisma.$disconnect();
    process.exit(1);
  }
}

cleanupExpiredTokens();
