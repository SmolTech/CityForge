#!/usr/bin/env node

/**
 * Database initialization script using Node.js and Prisma
 * This replaces the Flask-based initialize_db.py script
 */

// Construct DATABASE_URL if not already set (for Kubernetes deployments)
if (!process.env.DATABASE_URL) {
  const user = process.env.POSTGRES_USER || "postgres";
  const password = process.env.POSTGRES_PASSWORD || "postgres";
  const host = process.env.POSTGRES_HOST || "cityforge-db";
  const port = process.env.POSTGRES_PORT || "5432";
  const database = process.env.POSTGRES_DB || "cityforge";

  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  console.log(
    `Constructed DATABASE_URL: postgresql://${user}:***@${host}:${port}/${database}`
  );
}

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

async function initializeDatabase() {
  console.log("Starting database initialization...");

  const prisma = new PrismaClient();

  try {
    // Connect to database
    await prisma.$connect();
    console.log("Connected to database");

    // Check if tables exist by trying a simple query
    let tablesExist = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM users LIMIT 1`;
      tablesExist = true;
      console.log("Database schema appears to exist");

      // Check if the schema is up-to-date by looking for email_verified field
      try {
        await prisma.$queryRaw`SELECT email_verified FROM users LIMIT 1`;
        console.log(
          "Schema appears to be up-to-date with email verification fields"
        );
      } catch (error) {
        console.log(
          "Schema is outdated - missing email verification fields, need to recreate"
        );
        tablesExist = false; // Force recreation
      }
    } catch (error) {
      // Tables don't exist, we need to create them
      console.log("Database schema missing, need to create tables...");
    }

    if (!tablesExist) {
      console.log("Creating database schema from migration files...");

      // Read the migration SQL file and execute it
      // We'll use the 0_init migration which should have all the table definitions
      const migrationPath = join(
        process.cwd(),
        "prisma",
        "migrations",
        "0_init",
        "migration.sql"
      );

      try {
        const migrationSQL = readFileSync(migrationPath, "utf8");
        console.log(`Read migration file: ${migrationPath}`);

        // Parse SQL statements - split by semicolon and clean up
        const statements = migrationSQL
          .split(";")
          .map((statement) => {
            // Remove comment lines but preserve SQL content
            const lines = statement.split("\n");
            const sqlLines = lines.filter((line) => {
              const trimmed = line.trim();
              // Keep line if it's not empty and not a comment line
              return trimmed && !trimmed.startsWith("--");
            });
            return sqlLines.join("\n").trim();
          })
          .filter((statement) => statement.length > 0); // Filter out empty statements

        console.log(`Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        for (const statement of statements) {
          if (statement.trim()) {
            await prisma.$executeRawUnsafe(statement);
          }
        }

        console.log(
          "Database schema created successfully from migration files"
        );
      } catch (sqlError) {
        console.error(
          "Failed to create schema from migration SQL:",
          sqlError.message
        );
        throw sqlError;
      }

      console.log("Database schema created successfully");
    }

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

    // Create admin user if environment variables are provided
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      console.log(`Checking for admin user: ${adminEmail}`);

      const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
      });

      if (existingAdmin) {
        if (existingAdmin.role === "admin") {
          console.log("Admin user already exists with admin role");
        } else {
          // Promote existing user to admin
          await prisma.user.update({
            where: { id: existingAdmin.id },
            data: { role: "admin" },
          });
          console.log("✅ Promoted existing user to admin role");
        }
      } else {
        // Create new admin user
        const bcrypt = await import("bcrypt");
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const adminUser = await prisma.user.create({
          data: {
            email: adminEmail,
            passwordHash: hashedPassword,
            firstName: "Admin",
            lastName: "User",
            role: "admin",
            isActive: true,
            createdDate: new Date(),
          },
        });
        console.log(
          `✅ Created admin user: ${adminEmail} (ID: ${adminUser.id})`
        );
      }
    } else {
      console.log(
        "No admin credentials provided (ADMIN_EMAIL/ADMIN_PASSWORD not set)"
      );
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
