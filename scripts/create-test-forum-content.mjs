#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createTestForumContent() {
  try {
    console.log("Creating test forum content...");

    // Get admin user and categories
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin@test.com" },
    });

    if (!adminUser) {
      throw new Error("Admin user not found");
    }

    const categories = await prisma.forumCategory.findMany({
      orderBy: { displayOrder: "asc" },
    });

    console.log(`Found ${categories.length} categories to populate`);

    // Create test threads and posts for each category
    for (const category of categories) {
      console.log(`\n📁 Creating content for: ${category.name}`);

      // Create 2-3 threads per category
      const threadCount = Math.floor(Math.random() * 2) + 2; // 2-3 threads

      for (let i = 1; i <= threadCount; i++) {
        // Generate a slug for the thread
        const baseSlug = `sample-thread-${i}-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        const slug = `${baseSlug}-${Date.now()}`; // Ensure uniqueness

        const thread = await prisma.forumThread.create({
          data: {
            title: `Sample Thread ${i} in ${category.name}`,
            slug: slug,
            categoryId: category.id,
            createdBy: adminUser.id,
            isPinned: i === 1, // Pin the first thread
            isLocked: false,
            reportCount: 0,
            createdDate: new Date(),
          },
        });

        console.log(`  📄 Created thread: ${thread.title}`);

        // Create the first post (OP post) for the thread
        await prisma.forumPost.create({
          data: {
            content: `This is the original post for thread "${thread.title}". This thread demonstrates the forum functionality and contains sample discussion content.`,
            threadId: thread.id,
            createdBy: adminUser.id,
            isFirstPost: true,
            reportCount: 0,
            createdDate: new Date(),
          },
        });

        console.log(`    💬 Created OP post for thread ${thread.id}`);

        // Create 1-3 additional reply posts per thread
        const replyCount = Math.floor(Math.random() * 3) + 1; // 1-3 replies

        for (let j = 1; j <= replyCount; j++) {
          await prisma.forumPost.create({
            data: {
              content: `This is reply ${j} to thread "${thread.title}". This is sample forum discussion content with varied responses and engagement.`,
              threadId: thread.id,
              createdBy: adminUser.id,
              isFirstPost: false,
              reportCount: 0,
              createdDate: new Date(Date.now() + j * 60000), // Space replies 1 minute apart
            },
          });
          console.log(`    💬 Created reply ${j} in thread ${thread.id}`);
        }
      }
    }

    // Get final statistics
    const stats = await prisma.forumCategory.findMany({
      include: {
        _count: {
          select: {
            threads: true,
          },
        },
      },
    });

    console.log("\n📊 Final Forum Statistics:");
    for (const category of stats) {
      const postCount = await prisma.forumPost.count({
        where: {
          thread: {
            categoryId: category.id,
          },
        },
      });

      console.log(
        `  ${category.name}: ${category._count.threads} threads, ${postCount} posts`
      );
    }

    console.log("\n✅ Forum content creation completed successfully!");
  } catch (error) {
    console.error("❌ Error creating forum content:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestForumContent();
