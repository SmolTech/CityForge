#!/usr/bin/env node

/**
 * Comprehensive database seeding script for Kubernetes deployment
 * Uses PostgreSQL operator secrets and config maps for connection
 */

// Construct DATABASE_URL using environment variables from Kubernetes
if (!process.env.DATABASE_URL) {
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || "5432";
  const database = process.env.POSTGRES_DB;

  // Validate required environment variables
  if (!user || !password || !host || !database) {
    console.error("❌ Missing required PostgreSQL environment variables:");
    console.error("  POSTGRES_USER:", user ? "✓" : "❌");
    console.error("  POSTGRES_PASSWORD:", password ? "✓" : "❌");
    console.error("  POSTGRES_HOST:", host ? "✓" : "❌");
    console.error("  POSTGRES_DB:", database ? "✓" : "❌");
    console.error(
      "  POSTGRES_PORT:",
      port ? "✓" : "❌ (optional, defaults to 5432)"
    );
    process.exit(1);
  }

  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  console.log(
    `🔗 Constructed DATABASE_URL: postgresql://${user}:***@${host}:${port}/${database}`
  );
} else {
  console.log("🔗 Using existing DATABASE_URL");
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

/**
 * Initialize database schema and core data
 */
async function initializeDatabase() {
  console.log("🏗️  Initializing database schema...");

  try {
    // Test database connectivity
    await prisma.$connect();
    console.log("✅ Connected to database");

    // Check if schema exists (for logging purposes)
    try {
      await prisma.$queryRaw`SELECT 1 FROM users LIMIT 1`;
      console.log("✅ Database schema already exists");
    } catch {
      console.log("📋 Schema not found, will be created by Prisma migrations");
    }

    // Ensure Prisma schema is up to date
    console.log("🔄 Running Prisma migrations...");
    const { spawn } = await import("child_process");

    await new Promise((resolve, reject) => {
      const migration = spawn("npx", ["prisma", "migrate", "deploy"], {
        stdio: "inherit",
        env: process.env,
      });

      migration.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Prisma migrations completed");
          resolve();
        } else {
          reject(new Error(`Migration failed with exit code ${code}`));
        }
      });
    });

    // Create default resource categories
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

    for (const category of categories) {
      await prisma.resourceCategory.upsert({
        where: { name: category.name },
        update: {},
        create: category,
      });
    }
    console.log(`✅ Created ${categories.length} resource categories`);

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
    console.log(`✅ Created ${defaultConfig.length} configuration items`);
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    throw error;
  }
}

/**
 * Create admin user if credentials provided
 */
async function createAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log(
      "⚠️  No admin credentials provided (ADMIN_EMAIL/ADMIN_PASSWORD not set)"
    );
    return;
  }

  console.log(`👑 Creating admin user: ${adminEmail}`);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    if (existingAdmin.role === "admin") {
      console.log("✅ Admin user already exists with admin role");
    } else {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: "admin" },
      });
      console.log("✅ Promoted existing user to admin role");
    }
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
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
    console.log(`✅ Created admin user: ${adminEmail} (ID: ${adminUser.id})`);
  }
}

/**
 * Seed sample business cards and data
 */
async function seedSampleData() {
  console.log("🌱 Seeding sample business data...");

  // Create sample tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { name: "Restaurant" },
      update: {},
      create: { name: "Restaurant" },
    }),
    prisma.tag.upsert({
      where: { name: "Coffee Shop" },
      update: {},
      create: { name: "Coffee Shop" },
    }),
    prisma.tag.upsert({
      where: { name: "Local Business" },
      update: {},
      create: { name: "Local Business" },
    }),
    prisma.tag.upsert({
      where: { name: "Hardware Store" },
      update: {},
      create: { name: "Hardware Store" },
    }),
    prisma.tag.upsert({
      where: { name: "Bookstore" },
      update: {},
      create: { name: "Bookstore" },
    }),
    prisma.tag.upsert({
      where: { name: "Healthcare" },
      update: {},
      create: { name: "Healthcare" },
    }),
  ]);

  console.log(`✅ Created ${tags.length} tags`);

  // Create sample forum categories
  const forumCategories = [
    {
      name: "General Discussion",
      description: "General community discussions and announcements",
      displayOrder: 1,
    },
    {
      name: "Local Events",
      description: "Community events, meetings, and activities",
      displayOrder: 2,
    },
    {
      name: "Business Directory",
      description: "Discussions about local businesses and services",
      displayOrder: 3,
    },
    {
      name: "Help & Support",
      description: "Get help with using the platform",
      displayOrder: 4,
    },
  ];

  for (const category of forumCategories) {
    await prisma.forumCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
  console.log(`✅ Created ${forumCategories.length} forum categories`);

  // Create sample business cards
  const sampleCards = [
    {
      name: "Mario's Pizza Palace",
      description:
        "Authentic Italian pizza made fresh daily with locally sourced ingredients. Family-owned for over 30 years.",
      websiteUrl: "https://mariospizza.example.com",
      phoneNumber: "(555) 123-4567",
      email: "info@mariospizza.com",
      address: "123 Main Street, Downtown",
      contactName: "Mario Rossi",
      featured: true,
      approved: true,
      tags: ["Restaurant", "Local Business"],
    },
    {
      name: "The Coffee Corner",
      description:
        "Artisan coffee roasted in-house. Perfect spot for remote work with free WiFi and cozy atmosphere.",
      websiteUrl: "https://coffeecorner.example.com",
      phoneNumber: "(555) 234-5678",
      email: "hello@coffeecorner.com",
      address: "456 Oak Avenue, Midtown",
      contactName: "Sarah Johnson",
      featured: false,
      approved: true,
      tags: ["Coffee Shop", "Local Business"],
    },
    {
      name: "Bob's Hardware Emporium",
      description:
        "Your neighborhood hardware store with everything you need for home improvement projects. Expert advice included!",
      websiteUrl: "https://bobshardware.example.com",
      phoneNumber: "(555) 345-6789",
      email: "service@bobshardware.com",
      address: "789 Pine Street, Westside",
      contactName: "Bob Williams",
      featured: true,
      approved: true,
      tags: ["Hardware Store", "Local Business"],
    },
    {
      name: "Community Health Clinic",
      description:
        "Affordable healthcare services for the community. Walk-ins welcome.",
      websiteUrl: "https://communityclinic.example.com",
      phoneNumber: "(555) 456-7890",
      email: "appointments@communityclinic.com",
      address: "321 Elm Street, East End",
      contactName: "Dr. Jennifer Chen",
      featured: true,
      approved: true,
      tags: ["Healthcare", "Local Business"],
    },
  ];

  let createdCount = 0;
  for (const cardData of sampleCards) {
    try {
      // Check if card already exists
      const existingCard = await prisma.card.findFirst({
        where: { name: cardData.name },
      });

      if (existingCard) {
        console.log(`⏭️  Card already exists: ${cardData.name}`);
        continue;
      }

      // Extract tags from card data
      const { tags: cardTags, ...cardInfo } = cardData;

      const card = await prisma.card.create({
        data: {
          ...cardInfo,
          tags: {
            connect: cardTags.map((tagName) => ({ name: tagName })),
          },
        },
        include: {
          tags: true,
        },
      });

      console.log(`✅ Created card: ${card.name}`);
      createdCount++;
    } catch (error) {
      console.error(
        `❌ Failed to create card: ${cardData.name} - ${error.message}`
      );
    }
  }

  console.log(`✅ Created ${createdCount} business cards`);

  // Show final statistics
  const [totalCards, totalTags, totalUsers] = await Promise.all([
    prisma.card.count(),
    prisma.tag.count(),
    prisma.user.count(),
  ]);

  console.log("📊 Database statistics:");
  console.log(`   Users: ${totalUsers}`);
  console.log(`   Business Cards: ${totalCards}`);
  console.log(`   Tags: ${totalTags}`);
}

/**
 * Main seeding function
 */
async function main() {
  console.log("🚀 Starting database seeding...");
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Database Host: ${process.env.POSTGRES_HOST}`);
  console.log(`   Database Name: ${process.env.POSTGRES_DB}`);

  try {
    // Initialize database schema and core data
    await initializeDatabase();

    // Create admin user if credentials provided
    await createAdminUser();

    // Check if we should seed sample data
    const shouldSeedSampleData = process.env.SEED_SAMPLE_DATA !== "false";

    if (shouldSeedSampleData) {
      console.log("🌱 Seeding sample data...");
      await seedSampleData();
    } else {
      console.log("⏭️  Skipping sample data (SEED_SAMPLE_DATA=false)");
    }

    // Verify database functionality
    await prisma.$queryRaw`SELECT version()`;
    console.log("✅ Database connection verified");

    console.log("🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

export {
  main as seedDatabase,
  initializeDatabase,
  createAdminUser,
  seedSampleData,
};
