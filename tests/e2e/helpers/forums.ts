import { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { getOrCreateSystemUser } from "./database";

/**
 * E2E Test Helpers for Forums
 */

let prisma: PrismaClient | null = null;

/**
 * Get Prisma client instance
 */
function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl:
        process.env["DATABASE_URL"] ||
        "postgresql://postgres:postgres@localhost:5432/cityforge_test",
    });
  }
  return prisma;
}

/**
 * Create a forum category in the database
 */
export async function createForumCategory(data: {
  name: string;
  description: string;
  createdBy?: number;
  slug?: string;
  displayOrder?: number;
  isActive?: boolean;
}) {
  const db = getPrisma();

  // Get or create system user if createdBy not provided
  let createdBy = data.createdBy;
  if (!createdBy) {
    const systemUser = await getOrCreateSystemUser();
    createdBy = systemUser.id;
  }

  const category = await db.forumCategory.create({
    data: {
      name: data.name,
      description: data.description,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-"),
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
      createdBy,
    },
  });

  return category;
}

/**
 * Create a forum thread in the database
 */
export async function createForumThread(data: {
  title: string;
  content: string;
  categoryId: number;
  createdBy: number;
  isPinned?: boolean;
  isLocked?: boolean;
}) {
  const db = getPrisma();

  const thread = await db.forumThread.create({
    data: {
      title: data.title,
      slug:
        data.title.toLowerCase().replace(/\s+/g, "-") +
        "-" +
        Date.now().toString().slice(-6),
      categoryId: data.categoryId,
      createdBy: data.createdBy,
      isPinned: data.isPinned ?? false,
      isLocked: data.isLocked ?? false,
      reportCount: 0,
    },
  });

  // Create the first post
  await db.forumPost.create({
    data: {
      content: data.content,
      threadId: thread.id,
      createdBy: data.createdBy,
      isFirstPost: true,
      reportCount: 0,
    },
  });

  return thread;
}

/**
 * Create a forum post in the database
 */
export async function createForumPost(data: {
  content: string;
  threadId: number;
  createdBy: number;
}) {
  const db = getPrisma();

  const post = await db.forumPost.create({
    data: {
      content: data.content,
      threadId: data.threadId,
      createdBy: data.createdBy,
      isFirstPost: false,
      reportCount: 0,
    },
  });

  return post;
}

/**
 * Navigate to forums page
 */
export async function goToForums(page: Page) {
  await page.goto("/forums");
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to a specific category
 */
export async function goToCategory(page: Page, categorySlug: string) {
  await page.goto(`/forums/${categorySlug}`);
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to a specific thread
 */
export async function goToThread(
  page: Page,
  categorySlug: string,
  threadId: number
) {
  await page.goto(`/forums/${categorySlug}/${threadId}`);
  await page.waitForLoadState("networkidle");
}

/**
 * Create a new thread via UI
 */
export async function createThreadViaUI(
  page: Page,
  categorySlug: string,
  threadData: {
    title: string;
    content: string;
  }
) {
  await goToCategory(page, categorySlug);

  // Click "New Thread" button
  await page.click('a[href*="/new"]');

  // Fill in thread form
  await page.fill('input[name="title"]', threadData.title);
  await page.fill('textarea[name="content"]', threadData.content);

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(`/api/forums/categories/${categorySlug}/threads`) &&
      response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for response
  const response = await responsePromise;
  const statusCode = response.status();

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Thread creation failed with status code: ${statusCode}`);
  }

  // Wait for redirect to thread page
  await page.waitForURL(/\/forums\/[^/]+\/\d+/, { timeout: 5000 });
}

/**
 * Post a reply via UI
 */
export async function postReplyViaUI(
  page: Page,
  categorySlug: string,
  threadId: number,
  content: string
) {
  await goToThread(page, categorySlug, threadId);

  // Fill in reply form
  await page.fill('textarea[name="content"]', content);

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(`/posts`) && response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit form
  await page.click('button:has-text("Post Reply")');

  // Wait for response
  const response = await responsePromise;
  const statusCode = response.status();

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Post reply failed with status code: ${statusCode}`);
  }

  // Wait for new post to appear
  await page.waitForTimeout(1000);
}

/**
 * Report a post via UI
 */
export async function reportPostViaUI(
  page: Page,
  postSelector: string,
  reason: string,
  details?: string
) {
  // Click report button on the post
  await page.click(`${postSelector} button:has-text("Report")`);

  // Wait for report modal to appear
  await page.waitForSelector('[data-testid="report-modal"]', {
    timeout: 5000,
  });

  // Select reason
  await page.selectOption('select[name="reason"]', reason);

  // Fill in details if provided
  if (details) {
    await page.fill('textarea[name="details"]', details);
  }

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/forums/reports") && response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit report
  await page.click('button:has-text("Submit Report")');

  // Wait for response
  const response = await responsePromise;
  const statusCode = response.status();

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Report submission failed with status code: ${statusCode}`);
  }
}

/**
 * Request a new category via UI
 */
export async function requestCategoryViaUI(
  page: Page,
  categoryData: {
    name: string;
    description: string;
    justification: string;
  }
) {
  await page.goto("/forums/request-category");

  // Fill in category request form
  await page.fill('input[name="name"]', categoryData.name);
  await page.fill('textarea[name="description"]', categoryData.description);
  await page.fill('textarea[name="justification"]', categoryData.justification);

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/forums/category-requests") &&
      response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for response
  const response = await responsePromise;
  const statusCode = response.status();

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Category request failed with status code: ${statusCode}`);
  }

  // Wait for success message or redirect
  await page.waitForTimeout(1000);
}

/**
 * Navigate to admin forums page
 */
export async function goToAdminForums(page: Page) {
  await page.goto("/admin/forums");
  await page.waitForLoadState("networkidle");
}

/**
 * Create a category as admin via UI
 */
export async function createCategoryAsAdmin(
  page: Page,
  categoryData: {
    name: string;
    description: string;
  }
) {
  await goToAdminForums(page);

  // Click "Add Category" button
  await page.click('button:has-text("Add Category")');

  // Fill in category form
  await page.fill('input[name="name"]', categoryData.name);
  await page.fill('textarea[name="description"]', categoryData.description);

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/forums/categories") &&
      response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit form
  await page.click('button:has-text("Create Category")');

  // Wait for response
  const response = await responsePromise;
  const statusCode = response.status();

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Category creation failed with status code: ${statusCode}`);
  }

  // Wait for category to appear in list
  await page.waitForTimeout(1000);
}

/**
 * Approve a category request as admin
 */
export async function approveCategoryRequest(page: Page, requestName: string) {
  await goToAdminForums(page);

  // Switch to "Category Requests" tab
  await page.click('button:has-text("Category Requests")');

  // Find the request and click approve
  const requestCard = page.locator(
    `div:has-text("${requestName}"):has(button:has-text("Approve"))`
  );
  await requestCard.locator('button:has-text("Approve")').click();

  // Wait for success
  await page.waitForTimeout(1000);
}

/**
 * Resolve a report as admin
 */
export async function resolveReport(
  page: Page,
  action: "dismiss" | "delete_post" | "delete_thread"
) {
  await goToAdminForums(page);

  // Switch to "Reports" tab
  await page.click('button:has-text("Reports")');

  // Click the appropriate action button
  let buttonText = "Dismiss";
  if (action === "delete_post") buttonText = "Delete Post";
  if (action === "delete_thread") buttonText = "Delete Thread";

  await page.locator(`button:has-text("${buttonText}")`).first().click();

  // Confirm in modal
  await page.click('button:has-text("Confirm")');

  // Wait for success
  await page.waitForTimeout(1000);
}

/**
 * Check if a thread exists on the page
 */
export async function threadExists(
  page: Page,
  threadTitle: string
): Promise<boolean> {
  try {
    await page.waitForSelector(`text=${threadTitle}`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a post exists on the page
 */
export async function postExists(
  page: Page,
  postContent: string
): Promise<boolean> {
  try {
    await page.waitForSelector(`text=${postContent}`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
