#!/usr/bin/env node

/**
 * Token cleanup script using Node.js and Prisma
 * This replaces the Flask-based cleanup_expired_tokens.py script
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../src/lib/logger.js";

async function cleanupExpiredTokens() {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    logger.info("Starting expired token cleanup...");

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

    logger.info(`Cleaned up ${result.count} expired tokens from blacklist`, {
      expiredBefore: expiredBefore.toISOString(),
      deletedCount: result.count,
    });

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error("Error cleaning up expired tokens:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    await prisma.$disconnect();
    process.exit(1);
  }
}

cleanupExpiredTokens();
