#!/usr/bin/env node

/**
 * Seed forum categories for the community platform
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedForumCategories() {
  try {
    await prisma.$connect();
    console.log("Connected to database");

    // Check if we need an admin user for created_by
    const adminUser = await prisma.user.findFirst({
      where: { role: "admin" },
    });

    if (!adminUser) {
      console.error("No admin user found. Please create an admin user first.");
      process.exit(1);
    }

    console.log("Using admin user:", adminUser.email);

    // Define forum categories that would be appropriate for a community platform
    const categories = [
      {
        name: "General Discussion",
        description: "General community discussions and conversations",
        slug: "general-discussion",
        displayOrder: 1,
        isActive: true,
        createdBy: adminUser.id,
      },
      {
        name: "Shrewsbury Night Life",
        description:
          "Discussions about entertainment, bars, restaurants, and nightlife in Shrewsbury",
        slug: "shrewsbury-night-life",
        displayOrder: 2,
        isActive: true,
        createdBy: adminUser.id,
      },
      {
        name: "Local Events",
        description: "Community events, festivals, and local happenings",
        slug: "local-events",
        displayOrder: 3,
        isActive: true,
        createdBy: adminUser.id,
      },
      {
        name: "Business Directory",
        description: "Discuss local businesses and share recommendations",
        slug: "business-directory",
        displayOrder: 4,
        isActive: true,
        createdBy: adminUser.id,
      },
      {
        name: "Community News",
        description: "Local news, announcements, and community updates",
        slug: "community-news",
        displayOrder: 5,
        isActive: true,
        createdBy: adminUser.id,
      },
      {
        name: "Help & Support",
        description: "Get help with the platform or community resources",
        slug: "help-support",
        displayOrder: 6,
        isActive: true,
        createdBy: adminUser.id,
      },
    ];

    let createdCount = 0;
    for (const categoryData of categories) {
      try {
        const existingCategory = await prisma.forumCategory.findFirst({
          where: { slug: categoryData.slug },
        });

        if (existingCategory) {
          console.log("⏭️  Category already exists:", categoryData.name);
          continue;
        }

        const category = await prisma.forumCategory.create({
          data: categoryData,
        });
        console.log(
          "✅ Created forum category:",
          category.name,
          `(${category.slug})`
        );
        createdCount++;
      } catch (error) {
        console.error(
          "❌ Failed to create category:",
          categoryData.name,
          "Error:",
          error.message
        );
      }
    }

    console.log(
      "🎉 Successfully created",
      createdCount,
      "forum categories out of",
      categories.length,
      "attempts"
    );

    // Show final count
    const totalCategories = await prisma.forumCategory.count();
    console.log(
      "📊 Database now contains:",
      totalCategories,
      "forum categories"
    );

    // List all categories
    const allCategories = await prisma.forumCategory.findMany({
      orderBy: { displayOrder: "asc" },
      select: {
        name: true,
        slug: true,
        isActive: true,
        displayOrder: true,
      },
    });

    console.log("\n📋 Current forum categories:");
    allCategories.forEach((cat) => {
      console.log(
        `   ${cat.displayOrder}. ${cat.name} (${cat.slug}) ${cat.isActive ? "✅" : "❌"}`
      );
    });

    await prisma.$disconnect();
    console.log("\n✨ Forum category seeding completed successfully");
  } catch (error) {
    console.error("Error seeding forum categories:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  seedForumCategories();
}

export { seedForumCategories };
