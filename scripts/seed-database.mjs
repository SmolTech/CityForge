#!/usr/bin/env node

/**
 * Optional demo data seeding script for development and demonstrations.
 *
 * This script creates SAMPLE data (business cards, tags) for demo purposes.
 * It is NOT required for a fresh install — db-init.mjs handles all structural
 * data (site config, forum categories, resource categories, admin user).
 *
 * Usage:
 *   node scripts/seed-database.mjs              # Seeds demo data
 *   SEED_SAMPLE_DATA=false node scripts/seed-database.mjs  # Runs init only (no demo data)
 *
 * Environment variables (for Kubernetes):
 *   POSTGRES_USER     - from PostgreSQL operator secret
 *   POSTGRES_PASSWORD - from PostgreSQL operator secret
 *   POSTGRES_HOST     - from config map
 *   POSTGRES_PORT     - from config map (default: 5432)
 *   POSTGRES_DB       - from config map
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

const prisma = new PrismaClient();

/**
 * Seed sample business cards and tags for demonstration purposes.
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
      const existingCard = await prisma.card.findFirst({
        where: { name: cardData.name },
      });

      if (existingCard) {
        console.log(`⏭️  Card already exists: ${cardData.name}`);
        continue;
      }

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

  console.log(`✅ Created ${createdCount} sample business cards`);
}

/**
 * Main entry point
 */
async function main() {
  console.log("🚀 Starting database seeding...");
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);

  try {
    await prisma.$connect();
    console.log("✅ Connected to database");

    const shouldSeedSampleData = process.env.SEED_SAMPLE_DATA !== "false";

    if (shouldSeedSampleData) {
      await seedSampleData();
    } else {
      console.log("⏭️  Skipping sample data (SEED_SAMPLE_DATA=false)");
    }

    // Show final statistics
    const [totalCards, totalTags, totalUsers, totalCategories, totalConfig] =
      await Promise.all([
        prisma.card.count(),
        prisma.tag.count(),
        prisma.user.count(),
        prisma.forumCategory.count(),
        prisma.resourceConfig.count(),
      ]);

    console.log("📊 Database statistics:");
    console.log(`   Users: ${totalUsers}`);
    console.log(`   Business Cards: ${totalCards}`);
    console.log(`   Tags: ${totalTags}`);
    console.log(`   Forum Categories: ${totalCategories}`);
    console.log(`   Config Keys: ${totalConfig}`);

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

export { main as seedDatabase, seedSampleData };
