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

/**
 * Create or find admin user. Returns the admin user or null.
 */
async function ensureAdminUser(prisma) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log(
      "⚠️  No admin credentials provided (ADMIN_EMAIL/ADMIN_PASSWORD not set)"
    );
    // Return existing admin if one exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "admin" },
    });
    if (existingAdmin) {
      console.log(`   Found existing admin user: ${existingAdmin.email}`);
    }
    return existingAdmin;
  }

  console.log(`👑 Ensuring admin user: ${adminEmail}`);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    if (existingAdmin.role === "admin") {
      console.log("   Admin user already exists with admin role");
      return existingAdmin;
    }
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { role: "admin" },
    });
    console.log("   ✅ Promoted existing user to admin role");
    return { ...existingAdmin, role: "admin" };
  }

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
      emailVerified: true,
      createdDate: new Date(),
    },
  });
  console.log(`   ✅ Created admin user: ${adminEmail} (ID: ${adminUser.id})`);
  return adminUser;
}

/**
 * Create default resource categories (idempotent via upsert).
 */
async function ensureResourceCategories(prisma) {
  console.log("📂 Ensuring resource categories...");

  const categories = [
    { name: "Government Services", displayOrder: 1 },
    { name: "Healthcare", displayOrder: 2 },
    { name: "Education", displayOrder: 3 },
    { name: "Emergency Services", displayOrder: 4 },
    { name: "Utilities", displayOrder: 5 },
    { name: "Transportation", displayOrder: 6 },
    { name: "Recreation", displayOrder: 7 },
    { name: "Community Services", displayOrder: 8 },
  ];

  let created = 0;
  for (const category of categories) {
    const result = await prisma.resourceCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
    if (result) created++;
  }
  console.log(`   ✅ ${categories.length} resource categories ensured`);
}

/**
 * Create all site configuration keys with sensible defaults (idempotent).
 * Only inserts keys that don't already exist — never overwrites admin customizations.
 */
async function ensureSiteConfig(prisma) {
  console.log("⚙️  Ensuring site configuration...");

  const currentYear = new Date().getFullYear().toString();

  const defaultConfig = [
    // Site identity
    {
      key: "site_title",
      value: "CityForge Community",
      description: "Site title shown in browser tab and header",
    },
    {
      key: "site_tagline",
      value: "Community Directory",
      description: "Short tagline displayed below site title",
    },
    {
      key: "site_description",
      value: "Helping connect people to the resources available to them.",
      description: "Site meta description for search engines",
    },
    {
      key: "site_domain",
      value: "community.local",
      description: "Primary domain name for the site",
    },
    {
      key: "site_short_name",
      value: "CityForge",
      description: "Short name used in compact UI elements",
    },
    {
      key: "site_full_name",
      value: "CityForge Community",
      description: "Full site name used in formal contexts",
    },

    // Appearance
    {
      key: "site_theme_color",
      value: "#1f2937",
      description: "Primary theme color (hex)",
    },
    {
      key: "site_background_color",
      value: "#ffffff",
      description: "Background color (hex)",
    },

    // Copyright
    {
      key: "site_copyright",
      value: currentYear,
      description: "Copyright year",
    },
    {
      key: "site_copyright_holder",
      value: "CityForge Community",
      description: "Copyright holder name",
    },
    {
      key: "site_copyright_url",
      value: "#",
      description: "Link for copyright holder",
    },
    {
      key: "copyright_year",
      value: currentYear,
      description: "Copyright year (used by site-config page)",
    },
    {
      key: "copyright_holder",
      value: "CityForge Community",
      description: "Copyright holder (used by site-config page)",
    },
    {
      key: "copyright_url",
      value: "#",
      description: "Copyright URL (used by site-config page)",
    },

    // Directory page
    {
      key: "directory_tagline",
      value: "Discover Local Businesses",
      description: "Tagline shown on the business directory page",
    },
    {
      key: "directory_description",
      value: "Discover local resources and community information.",
      description: "Description shown on the business directory page",
    },

    // Resources page
    {
      key: "resources_title",
      value: "Local Resources",
      description: "Title for the resources page",
    },
    {
      key: "resources_description",
      value: "Essential links to local services and information",
      description: "Description for the resources page",
    },
    {
      key: "resources_footer_title",
      value: "Get in Touch",
      description: "Title shown in the resources page footer section",
    },
    {
      key: "resources_footer_description",
      value:
        "Have a question or want to suggest a resource? We'd love to hear from you.",
      description: "Description shown in the resources page footer section",
    },
    {
      key: "resources_contact_email",
      value: "admin@community.local",
      description: "Contact email shown on the resources page",
    },
    {
      key: "resources_button_text",
      value: "Contact Us",
      description: "Text for the contact button on the resources page",
    },

    // Pagination
    {
      key: "pagination_default_limit",
      value: "20",
      description: "Default number of items per page",
    },

    // Analytics (empty by default)
    {
      key: "google_analytics_id",
      value: "",
      description: "Google Analytics tracking ID (leave empty to disable)",
    },
  ];

  let created = 0;
  for (const config of defaultConfig) {
    // Only create if key doesn't exist — preserves admin customizations
    const existing = await prisma.resourceConfig.findUnique({
      where: { key: config.key },
    });
    if (!existing) {
      await prisma.resourceConfig.create({ data: config });
      created++;
    }
  }
  console.log(
    `   ✅ ${defaultConfig.length} config keys ensured (${created} newly created)`
  );
}

/**
 * Create default forum categories (idempotent).
 * Requires an admin user for the createdBy field.
 */
async function ensureForumCategories(prisma, adminUser) {
  if (!adminUser) {
    console.log(
      "⚠️  Skipping forum categories — no admin user available (set ADMIN_EMAIL/ADMIN_PASSWORD)"
    );
    return;
  }

  console.log("💬 Ensuring forum categories...");

  const categories = [
    {
      name: "General Discussion",
      description: "General community discussions and conversations",
      slug: "general-discussion",
      displayOrder: 1,
    },
    {
      name: "Local Events",
      description: "Community events, festivals, and local happenings",
      slug: "local-events",
      displayOrder: 2,
    },
    {
      name: "Business Directory",
      description: "Discuss local businesses and share recommendations",
      slug: "business-directory",
      displayOrder: 3,
    },
    {
      name: "Community News",
      description: "Local news, announcements, and community updates",
      slug: "community-news",
      displayOrder: 4,
    },
    {
      name: "Help & Support",
      description: "Get help with the platform or community resources",
      slug: "help-support",
      displayOrder: 5,
    },
  ];

  let created = 0;
  for (const categoryData of categories) {
    const existing = await prisma.forumCategory.findFirst({
      where: { slug: categoryData.slug },
    });
    if (!existing) {
      await prisma.forumCategory.create({
        data: {
          ...categoryData,
          isActive: true,
          createdBy: adminUser.id,
        },
      });
      created++;
    }
  }
  console.log(
    `   ✅ ${categories.length} forum categories ensured (${created} newly created)`
  );
}

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
      } catch {
        console.log(
          "Schema is outdated - missing email verification fields, need to recreate"
        );
        tablesExist = false; // Force recreation
      }
    } catch {
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

    // --- Step 1: Create admin user (needed before forum categories) ---
    const adminUser = await ensureAdminUser(prisma);

    // --- Step 2: Create default resource categories (idempotent) ---
    await ensureResourceCategories(prisma);

    // --- Step 3: Create site configuration with sensible defaults (idempotent) ---
    await ensureSiteConfig(prisma);

    // --- Step 4: Create default forum categories (idempotent) ---
    await ensureForumCategories(prisma, adminUser);

    // Test database functionality with a simple query
    await prisma.$queryRaw`SELECT version()`;
    console.log("✅ Database connection and queries working correctly");

    await prisma.$disconnect();
    console.log("🎉 Database initialization completed");
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
