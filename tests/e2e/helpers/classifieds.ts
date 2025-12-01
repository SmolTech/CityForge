import { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * E2E Test Helpers for Classifieds (Help Wanted)
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
 * Create a help wanted post in the database
 */
export async function createHelpWantedPost(data: {
  title: string;
  description: string;
  category: string;
  createdBy: number;
  status?: string;
  location?: string;
  budget?: string;
  contactPreference?: string;
}) {
  const db = getPrisma();

  const post = await db.helpWantedPost.create({
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      createdBy: data.createdBy,
      status: data.status || "open",
      location: data.location || null,
      budget: data.budget || null,
      contactPreference: data.contactPreference || null,
      reportCount: 0,
    },
  });

  return post;
}

/**
 * Create a help wanted comment in the database
 */
export async function createHelpWantedComment(data: {
  postId: number;
  content: string;
  createdBy: number;
  parentId?: number;
}) {
  const db = getPrisma();

  const comment = await db.helpWantedComment.create({
    data: {
      postId: data.postId,
      content: data.content,
      createdBy: data.createdBy,
      parentId: data.parentId || null,
    },
  });

  return comment;
}

/**
 * Navigate to classifieds page
 */
export async function goToClassifieds(page: Page) {
  await page.goto("/classifieds");
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to a specific classified post
 */
export async function goToClassifiedPost(page: Page, postId: number) {
  await page.goto(`/classifieds/${postId}`);
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to new classified page
 */
export async function goToNewClassified(page: Page) {
  await page.goto("/classifieds/new");
  await page.waitForLoadState("networkidle");
}

/**
 * Create a new classified post via UI
 */
export async function createClassifiedViaUI(
  page: Page,
  postData: {
    title: string;
    description: string;
    category: "hiring" | "collaboration" | "general";
    location?: string;
    budget?: string;
    contactPreference?: string;
  }
) {
  await goToNewClassified(page);

  // Fill in form
  await page.fill('input[id="title"]', postData.title);
  await page.selectOption('select[id="category"]', postData.category);
  await page.fill('textarea[id="description"]', postData.description);

  if (postData.location) {
    await page.fill('input[id="location"]', postData.location);
  }

  if (postData.budget) {
    await page.fill('input[id="budget"]', postData.budget);
  }

  if (postData.contactPreference) {
    await page.selectOption(
      'select[id="contact_preference"]',
      postData.contactPreference
    );
  }

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/help-wanted") &&
      response.request().method() === "POST" &&
      response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit form
  await page.click('button[type="submit"]:has-text("Post Request")');

  // Wait for response
  const response = await responsePromise;
  const statusCode = response.status();

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Post creation failed with status code: ${statusCode}`);
  }

  // Wait for redirect to post page
  await page.waitForURL(/\/classifieds\/\d+/, { timeout: 5000 });
}

/**
 * Update a classified post via UI - Currently only supports status toggle
 * Note: The current UI implementation only allows status toggling, not full editing
 */
export async function updateClassifiedViaUI(
  page: Page,
  postId: number,
  updates: {
    title?: string;
    description?: string;
    category?: "hiring" | "collaboration" | "general";
    status?: "open" | "closed";
    location?: string;
    budget?: string;
  }
) {
  await goToClassifiedPost(page, postId);

  // Only status updates are currently supported via UI
  if (updates.status) {
    // Get current status from the page
    const currentStatus = await page
      .locator('span:has-text("Open"), span:has-text("Closed")')
      .textContent();
    const isCurrentlyOpen = currentStatus?.toLowerCase() === "open";
    const wantsClosed = updates.status === "closed";

    // Only click the toggle if we need to change the status
    if (
      (isCurrentlyOpen && wantsClosed) ||
      (!isCurrentlyOpen && !wantsClosed)
    ) {
      // Wait for API response
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/help-wanted/${postId}`) &&
          response.request().method() === "PUT" &&
          response.status() !== 0,
        { timeout: 10000 }
      );

      // Click the status toggle button
      const toggleText = isCurrentlyOpen ? "Mark as Closed" : "Mark as Open";
      await page.click(`button:has-text("${toggleText}")`);

      // Wait for response
      const response = await responsePromise;
      const statusCode = response.status();

      if (statusCode !== 200) {
        throw new Error(`Status update failed with status code: ${statusCode}`);
      }

      // Wait for the UI to update
      await page.waitForTimeout(1000);
    }
  }

  // Warn about unsupported updates
  const unsupportedUpdates = [];
  if (updates.title) unsupportedUpdates.push("title");
  if (updates.description) unsupportedUpdates.push("description");
  if (updates.category) unsupportedUpdates.push("category");
  if (updates.location !== undefined) unsupportedUpdates.push("location");
  if (updates.budget !== undefined) unsupportedUpdates.push("budget");

  if (unsupportedUpdates.length > 0) {
    console.warn(
      `Warning: The following updates are not supported by the current UI: ${unsupportedUpdates.join(", ")}. ` +
        `Only status toggling is currently available. Consider updating tests or implementing edit functionality.`
    );
  }
}

/**
 * Delete a classified post via UI
 * Note: The current UI implementation does not provide delete functionality
 * This function will throw an error as delete is not available in the current UI
 */
export async function deleteClassifiedViaUI(page: Page, postId: number) {
  await goToClassifiedPost(page, postId);

  throw new Error(
    "Delete functionality is not available in the current UI implementation. " +
      "Consider removing delete tests or implementing delete functionality in the UI."
  );

  // Legacy code that no longer works:
  // await page.click('button:has-text("Delete")');
  // await page.click('button:has-text("Confirm")');
  // await page.waitForURL("/classifieds", { timeout: 5000 });
}

/**
 * Post a comment on a classified via UI
 */
export async function postCommentViaUI(
  page: Page,
  postId: number,
  content: string
) {
  await goToClassifiedPost(page, postId);

  // Fill in comment using placeholder selector since there's no name attribute
  await page.fill('textarea[placeholder="Add a comment..."]', content);

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/help-wanted/${postId}/comments`) &&
      response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit comment
  await page.click('button:has-text("Post Comment")');

  // Wait for response
  const response = await responsePromise;
  const statusCode = response.status();

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Comment creation failed with status code: ${statusCode}`);
  }

  // Wait for new comment to appear
  await page.waitForTimeout(1000);
}

/**
 * Report a classified post via UI
 */
export async function reportClassifiedViaUI(
  page: Page,
  postId: number,
  reason: "spam" | "inappropriate" | "misleading" | "other",
  details?: string
) {
  await goToClassifiedPost(page, postId);

  // Click report button
  await page.click('button:has-text("Report")');

  // Wait for report modal - looking for the modal content instead of test-id
  await page.waitForSelector('h3:has-text("Report Post")', {
    timeout: 5000,
  });

  // Select reason - the select doesn't have a name attribute, look for the select with options
  await page.selectOption("select", reason);

  // Fill in details if provided - the textarea doesn't have a name attribute
  if (details) {
    await page.fill("form textarea", details);
  }

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/help-wanted/${postId}/report`) &&
      response.status() !== 0,
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

  // Wait for success message
  await page.waitForTimeout(1000);
}

/**
 * Filter classifieds by category
 */
export async function filterByCategory(
  page: Page,
  category: "all" | "hiring" | "collaboration" | "general"
) {
  await goToClassifieds(page);
  // Find the select element within the category section
  const categorySelect = page
    .locator('label:has-text("Category")')
    .locator("..")
    .locator("select");
  await categorySelect.selectOption(category === "all" ? "all" : category);
  await page.waitForTimeout(500);
}

/**
 * Filter classifieds by status
 */
export async function filterByStatus(
  page: Page,
  status: "all" | "open" | "closed"
) {
  await goToClassifieds(page);
  // Find the select element within the status section
  const statusSelect = page
    .locator('label:has-text("Status")')
    .locator("..")
    .locator("select");
  await statusSelect.selectOption(status);
  await page.waitForTimeout(500);
}

/**
 * Search classifieds
 */
export async function searchClassifieds(page: Page, query: string) {
  await goToClassifieds(page);
  await page.fill('input[placeholder*="Search by title"]', query);
  await page.waitForTimeout(500);
}

/**
 * Navigate to admin classifieds page
 */
export async function goToAdminClassifieds(page: Page) {
  await page.goto("/admin/classifieds");
  await page.waitForLoadState("networkidle");
}

/**
 * Resolve a classified report as admin
 */
export async function resolveClassifiedReport(
  page: Page,
  action: "dismiss" | "delete_post",
  notes?: string
) {
  await goToAdminClassifieds(page);

  // Click resolve button on first report
  await page.locator('button:has-text("Resolve")').first().click();

  // Select action
  if (action === "delete_post") {
    await page.click('button:has-text("Delete Post")');
  } else {
    await page.click('button:has-text("Dismiss")');
  }

  // Add notes if provided
  if (notes) {
    await page.fill('textarea[name="notes"]', notes);
  }

  // Confirm
  await page.click('button:has-text("Confirm")');

  // Wait for success
  await page.waitForTimeout(1000);
}

/**
 * Check if a classified post exists on the page
 */
export async function classifiedExists(
  page: Page,
  postTitle: string
): Promise<boolean> {
  try {
    await page.waitForSelector(`text=${postTitle}`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a comment exists on the page
 */
export async function commentExists(
  page: Page,
  commentContent: string
): Promise<boolean> {
  try {
    await page.waitForSelector(`text=${commentContent}`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the count of posts displayed on the page
 */
export async function getPostCount(page: Page): Promise<number> {
  const posts = await page.locator('[href^="/classifieds/"]').count();
  return posts;
}
