import { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * E2E Test Helpers for Dashboard
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
 * Create a card submission in the database
 */
export async function createCardSubmission(data: {
  name: string;
  description?: string;
  submittedBy: number;
  status?: string;
  reviewNotes?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  websiteUrl?: string;
}) {
  const db = getPrisma();

  const submission = await db.cardSubmission.create({
    data: {
      name: data.name,
      description: data.description || null,
      address: data.address || null,
      phoneNumber: data.phoneNumber || null,
      email: data.email || null,
      websiteUrl: data.websiteUrl || null,
      submittedBy: data.submittedBy,
      status: data.status || "pending",
      reviewNotes: data.reviewNotes || null,
    },
  });

  return submission;
}

/**
 * Navigate to dashboard page
 */
export async function goToDashboard(page: Page) {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
}

/**
 * Get the count of approved submissions displayed
 */
export async function getApprovedCount(page: Page): Promise<number> {
  const approvedCard = page.locator('h3:has-text("Approved")').locator("..");
  const countText = await approvedCard
    .locator(".text-2xl")
    .first()
    .textContent();
  return parseInt(countText || "0", 10);
}

/**
 * Get the count of pending submissions displayed
 */
export async function getPendingCount(page: Page): Promise<number> {
  const pendingCard = page
    .locator('h3:has-text("Pending Review")')
    .locator("..");
  const countText = await pendingCard
    .locator(".text-2xl")
    .first()
    .textContent();
  return parseInt(countText || "0", 10);
}

/**
 * Get the count of open classified posts displayed
 */
export async function getOpenClassifiedsCount(page: Page): Promise<number> {
  const classifiedCard = page
    .locator('h3:has-text("Classified Posts")')
    .locator("..");
  const countText = await classifiedCard
    .locator(".text-2xl")
    .first()
    .textContent();
  // Extract just the number (e.g., "5 open" -> "5")
  const match = countText?.match(/(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

/**
 * Check if the empty submissions state is visible
 */
export async function hasEmptySubmissionsState(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('text="No submissions yet"', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the empty classifieds state is visible
 */
export async function hasEmptyClassifiedsState(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('text="No classified posts yet"', {
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a submission exists in the list
 */
export async function submissionExists(
  page: Page,
  submissionName: string
): Promise<boolean> {
  try {
    await page.waitForSelector(`text="${submissionName}"`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a classified post exists in the dashboard list
 */
export async function classifiedPostExists(
  page: Page,
  postTitle: string
): Promise<boolean> {
  try {
    await page.waitForSelector(`text="${postTitle}"`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the status badge text for a submission
 */
export async function getSubmissionStatus(
  page: Page,
  submissionName: string
): Promise<string | null> {
  const submissionRow = page.locator(`text="${submissionName}"`).locator("..");
  const statusBadge = submissionRow
    .locator('span[class*="rounded-full"]')
    .first();
  return await statusBadge.textContent();
}

/**
 * Check if review notes are displayed for a submission
 */
export async function hasReviewNotes(
  page: Page,
  submissionName: string
): Promise<boolean> {
  const submissionRow = page.locator(`text="${submissionName}"`).locator("..");
  try {
    await submissionRow.locator('text="Review notes:"').waitFor({
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the review notes text for a submission
 */
export async function getReviewNotes(
  page: Page,
  submissionName: string
): Promise<string | null> {
  const submissionRow = page.locator(`text="${submissionName}"`).locator("..");
  const notesContainer = submissionRow
    .locator('text="Review notes:"')
    .locator("..");
  const notesText = await notesContainer.textContent();
  // Extract text after "Review notes: "
  return notesText?.replace("Review notes: ", "") || null;
}

/**
 * Click the "Submit Content" quick action button
 */
export async function clickSubmitContentAction(page: Page) {
  await page.locator('a:has-text("Submit Content")').first().click();
  await page.waitForURL("/submit", { timeout: 5000 });
}

/**
 * Click the "Post Request" quick action button
 */
export async function clickPostRequestAction(page: Page) {
  await page.locator('a:has-text("Post Request")').first().click();
  await page.waitForURL("/classifieds/new", { timeout: 5000 });
}

/**
 * Click the "View All Posts" link in classified section
 */
export async function clickViewAllClassifieds(page: Page) {
  await page.click('a:has-text("View All Posts")');
  await page.waitForURL("/classifieds", { timeout: 5000 });
}

/**
 * Click on a classified post in the dashboard list
 */
export async function clickClassifiedPost(page: Page, postTitle: string) {
  await page.click(`text="${postTitle}"`);
  await page.waitForURL(/\/classifieds\/\d+/, { timeout: 5000 });
}

/**
 * Get the count of submissions in the list
 */
export async function getSubmissionsListCount(page: Page): Promise<number> {
  const submissionsSection = page.locator('h2:has-text("Your Submissions")');
  const submissionRows = submissionsSection
    .locator("..")
    .locator("..")
    .locator('div[class*="divide-y"]')
    .locator("> div");
  return await submissionRows.count();
}

/**
 * Get the count of classified posts in the list
 */
export async function getClassifiedsListCount(page: Page): Promise<number> {
  const classifiedsSection = page.locator(
    'h2:has-text("Your Classified Posts")'
  );
  const postRows = classifiedsSection
    .locator("..")
    .locator("..")
    .locator('div[class*="divide-y"]')
    .locator("> div");
  return await postRows.count();
}

/**
 * Check if the dashboard is showing a rate limit error
 */
export async function hasRateLimitError(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('text="Too many requests"', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Click the retry button on an error message
 */
export async function clickRetryButton(page: Page) {
  await page.click('button:has-text("Retry")');
  await page.waitForTimeout(1000);
}

/**
 * Check if email verification banner is visible
 */
export async function hasEmailVerificationBanner(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('[data-testid="email-verification-banner"]', {
      timeout: 2000,
    });
    return true;
  } catch {
    // Try alternative selector
    try {
      await page.waitForSelector('text="Please verify your email"', {
        timeout: 2000,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get the status color class for a submission
 */
export async function getSubmissionStatusColor(
  page: Page,
  submissionName: string
): Promise<string | null> {
  const submissionRow = page.locator(`text="${submissionName}"`).locator("..");
  const statusBadge = submissionRow
    .locator('span[class*="rounded-full"]')
    .first();
  const className = await statusBadge.getAttribute("class");
  return className;
}

/**
 * Get the category badge text for a classified post
 */
export async function getClassifiedCategory(
  page: Page,
  postTitle: string
): Promise<string | null> {
  const postRow = page.locator(`text="${postTitle}"`).locator("..");
  const categoryBadge = postRow
    .locator('span[class*="rounded-full"]')
    .filter({ hasText: /hiring|collaboration|general/i })
    .first();
  return await categoryBadge.textContent();
}

/**
 * Get the comment count for a classified post in the dashboard
 */
export async function getClassifiedCommentCount(
  page: Page,
  postTitle: string
): Promise<number> {
  const postRow = page.locator(`text="${postTitle}"`).locator("..");
  const commentText = await postRow
    .locator("text=/\\d+ comments?/")
    .textContent();
  const match = commentText?.match(/(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

/**
 * Check if the loading spinner is visible
 */
export async function isLoadingSpinnerVisible(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(".animate-spin", { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if error banner is visible
 */
export async function hasErrorBanner(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('[class*="bg-yellow-50"]', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an element is hidden
 */
export async function isElementHidden(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    const element = page.locator(selector);
    return await element.isHidden();
  } catch {
    return true;
  }
}

/**
 * Wait for dashboard to fully load
 */
export async function waitForDashboardLoad(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForSelector('text="Your Dashboard"', { timeout: 10000 });
}
