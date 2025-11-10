// Simple script to seed database with sample cards using Prisma
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database with sample cards...");

  // Create sample tags first
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
  ]);

  console.log(`✅ Created ${tags.length} tags`);

  // Create sample cards
  const cards = [
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
      tags: {
        connect: [{ name: "Restaurant" }, { name: "Local Business" }],
      },
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
      tags: {
        connect: [{ name: "Coffee Shop" }, { name: "Local Business" }],
      },
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
      tags: {
        connect: [{ name: "Hardware Store" }, { name: "Local Business" }],
      },
    },
    {
      name: "Literary Treasures",
      description:
        "Independent bookstore specializing in rare books and local authors. Hosting book clubs and reading events.",
      websiteUrl: "https://literarytreasures.example.com",
      phoneNumber: "(555) 456-7890",
      email: "books@literarytreasures.com",
      address: "321 Elm Street, East End",
      contactName: "Jennifer Chen",
      featured: false,
      approved: true,
      tags: {
        connect: [{ name: "Bookstore" }, { name: "Local Business" }],
      },
    },
    {
      name: "Sunrise Diner",
      description:
        "Classic American diner serving breakfast all day. Famous for our homemade pies and friendly service.",
      websiteUrl: "https://sunrisediner.example.com",
      phoneNumber: "(555) 567-8901",
      email: "orders@sunrisediner.com",
      address: "654 Maple Drive, South Side",
      contactName: "Tom Anderson",
      featured: false,
      approved: true,
      tags: {
        connect: [{ name: "Restaurant" }, { name: "Local Business" }],
      },
    },
  ];

  let createdCount = 0;
  for (const cardData of cards) {
    try {
      const card = await prisma.card.create({
        data: cardData,
        include: {
          tags: true,
        },
      });
      console.log(`✅ Created card: ${card.name}`);
      createdCount++;
    } catch (error) {
      console.error(
        `❌ Failed to create card: ${cardData.name}`,
        error.message
      );
    }
  }

  console.log(
    `\n🎉 Successfully created ${createdCount} cards out of ${cards.length} attempts`
  );

  // Show final count
  const totalCards = await prisma.card.count();
  const totalTags = await prisma.tag.count();
  console.log(
    `📊 Database now contains: ${totalCards} cards and ${totalTags} tags`
  );
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
