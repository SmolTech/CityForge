#!/usr/bin/env node

/**
 * Seed test data for development and testing
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedTestData() {
  try {
    await prisma.$connect();
    console.log("Connected to database");

    // Create test users
    const testUser = await prisma.user.upsert({
      where: { email: "test@example.com" },
      update: {},
      create: {
        email: "test@example.com",
        passwordHash:
          "$2b$12$nvRN7WaKlTM9ZnnyloZ/b.q2jtEicknqqFiiVsvUWoo3l2wBB1Dgu", // password: "testpassword"
        firstName: "Test",
        lastName: "User",
        role: "user",
        isActive: true,
      },
    });
    console.log("Created test user:", testUser.email);

    const adminUser = await prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: {
        email: "admin@example.com",
        passwordHash:
          "$2b$12$nvRN7WaKlTM9ZnnyloZ/b.q2jtEicknqqFiiVsvUWoo3l2wBB1Dgu", // password: "testpassword"
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        isActive: true,
      },
    });
    console.log("Created admin user:", adminUser.email);

    // Create test tags
    const businessTag = await prisma.tag.upsert({
      where: { name: "Business" },
      update: {},
      create: { name: "Business" },
    });

    const restaurantTag = await prisma.tag.upsert({
      where: { name: "Restaurant" },
      update: {},
      create: { name: "Restaurant" },
    });

    // Create test business cards
    const existingCard = await prisma.card.findFirst({
      where: { name: "Test Coffee Shop" },
    });

    const testCard =
      existingCard ||
      (await prisma.card.create({
        data: {
          name: "Test Coffee Shop",
          description:
            "A great local coffee shop with excellent service and delicious coffee.",
          websiteUrl: "https://testcoffee.example.com",
          phoneNumber: "(555) 123-4567",
          email: "info@testcoffee.example.com",
          address: "123 Main St, Test City, TC 12345",
          contactName: "Jane Smith",
          imageUrl: "https://via.placeholder.com/400x300",
          approved: true,
          featured: false,
          createdBy: testUser.id,
          approvedBy: adminUser.id,
          approvedDate: new Date(),
        },
      }));
    console.log("Created test business card:", testCard.name);

    // Link tags to the card
    await prisma.card_tags.upsert({
      where: {
        card_id_tag_id: {
          card_id: testCard.id,
          tag_id: businessTag.id,
        },
      },
      update: {},
      create: {
        card_id: testCard.id,
        tag_id: businessTag.id,
      },
    });

    await prisma.card_tags.upsert({
      where: {
        card_id_tag_id: {
          card_id: testCard.id,
          tag_id: restaurantTag.id,
        },
      },
      update: {},
      create: {
        card_id: testCard.id,
        tag_id: restaurantTag.id,
      },
    });

    console.log("Linked tags to business card");

    // Create test reviews
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: testUser.id,
        cardId: testCard.id,
      },
    });

    const testReview =
      existingReview ||
      (await prisma.review.create({
        data: {
          userId: testUser.id,
          cardId: testCard.id,
          rating: 5,
          title: "Excellent Coffee!",
          comment:
            "Great atmosphere, friendly staff, and the best latte in town. Highly recommended!",
          hidden: false,
          reported: false,
        },
      }));
    console.log("Created test review:", testReview.title);

    // Create another test business card
    const existingCard2 = await prisma.card.findFirst({
      where: { name: "Test Bookstore" },
    });

    const testCard2 =
      existingCard2 ||
      (await prisma.card.create({
        data: {
          name: "Test Bookstore",
          description:
            "Independent bookstore with a wide selection of books and a cozy reading area.",
          websiteUrl: "https://testbooks.example.com",
          phoneNumber: "(555) 987-6543",
          email: "hello@testbooks.example.com",
          address: "456 Oak Ave, Test City, TC 12345",
          contactName: "John Doe",
          imageUrl: "https://via.placeholder.com/400x300",
          approved: true,
          featured: true,
          createdBy: adminUser.id,
          approvedBy: adminUser.id,
          approvedDate: new Date(),
        },
      }));
    console.log("Created second test business card:", testCard2.name);

    await prisma.$disconnect();
    console.log("Test data seeding completed successfully");
  } catch (error) {
    console.error("Error seeding test data:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData();
}

export { seedTestData };
