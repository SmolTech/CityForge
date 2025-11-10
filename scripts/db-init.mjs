#!/usr/bin/env node

/**
 * Database initialization script using Node.js and Prisma
 * This replaces the Flask-based initialize_db.py script
 */

import { PrismaClient } from "@prisma/client";

async function initializeDatabase() {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log("Connected to database");

    // Check if database is already initialized by looking for users table data
    const userCount = await prisma.user.count();
    console.log(`Found ${userCount} users in database`);

    if (userCount === 0) {
      console.log("Database appears to be fresh, creating default data...");

      // Create default resource categories
      const categories = [
        {
          name: "Government Services",
          displayOrder: 1,
        },
        {
          name: "Healthcare",
          displayOrder: 2,
        },
        {
          name: "Education",
          displayOrder: 3,
        },
        {
          name: "Emergency Services",
          displayOrder: 4,
        },
        {
          name: "Utilities",
          displayOrder: 5,
        },
        {
          name: "Transportation",
          displayOrder: 6,
        },
        {
          name: "Recreation",
          displayOrder: 7,
        },
        {
          name: "Community Services",
          displayOrder: 8,
        },
      ];

      for (const category of categories) {
        await prisma.resourceCategory.upsert({
          where: { name: category.name },
          update: {},
          create: category,
        });
      }
      console.log(`Created ${categories.length} default resource categories`);

      // Create default site configuration
      const defaultConfig = [
        {
          key: "site_title",
          value: "CityForge Community",
          description: "Site title shown in browser and header",
        },
        {
          key: "site_description",
          value: "Community directory and resources",
          description: "Site meta description",
        },
        {
          key: "site_copyright",
          value: "© 2024 CityForge Community. All rights reserved.",
          description: "Copyright notice in footer",
        },
        {
          key: "pagination_default_limit",
          value: "20",
          description: "Default number of items per page in directory listings",
        },
      ];

      for (const config of defaultConfig) {
        await prisma.resourceConfig.upsert({
          where: { key: config.key },
          update: {},
          create: config,
        });
      }
      console.log(
        `Created ${defaultConfig.length} default configuration items`
      );

      console.log("Database initialization completed successfully");
    } else {
      console.log("Database already contains data, skipping initialization");
    }

    // Test database functionality with a simple query
    await prisma.$queryRaw`SELECT version()`;
    console.log("Database connection and queries working correctly");

    await prisma.$disconnect();
    console.log("Database initialization completed");
    process.exit(0);
  } catch (error) {
    console.error("Error initializing database:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export { initializeDatabase };
