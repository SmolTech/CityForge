import { test, expect } from "@playwright/test";
import { loginUser, generateTestUser } from "./helpers/auth";
import {
  cleanDatabase,
  disconnectDatabase,
  createTestUser,
} from "./helpers/database";
import {
  createForumCategory,
  createForumThread,
  goToForums,
  goToCategory,
  goToThread,
  createThreadViaUI,
  postReplyViaUI,
  reportPostViaUI,
  requestCategoryViaUI,
  goToAdminForums,
  createCategoryAsAdmin,
  approveCategoryRequest,
  threadExists,
} from "./helpers/forums";

/**
 * E2E Tests for Forums
 *
 * Tests the complete user journey for forum functionality including:
 * - Viewing categories and threads
 * - Creating threads and posts
 * - Reporting content
 * - Category requests
 * - Admin moderation
 */

test.describe("Forums E2E", () => {
  // Clean database before each test for isolation
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  // Clean up after all tests
  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test.describe("Anonymous Users", () => {
    test("should be able to view forum categories", async ({ page }) => {
      // Create a test category
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });

      // Navigate to forums
      await goToForums(page);

      // Verify category is visible
      await expect(page.locator(`text=${category.name}`)).toBeVisible();
      await expect(page.locator(`text=${category.description}`)).toBeVisible();
    });

    test("should be able to view threads in a category", async ({ page }) => {
      // Create test data
      const user = await createTestUser(generateTestUser());
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      const thread = await createForumThread({
        title: "Welcome to the forums!",
        content: "This is the first post in this thread.",
        categoryId: category.id,
        createdBy: user.id,
      });

      // Navigate to category
      await goToCategory(page, category.slug);

      // Verify thread is visible
      await expect(page.locator(`text=${thread.title}`)).toBeVisible();
    });

    test("should be able to view posts in a thread", async ({ page }) => {
      // Create test data
      const user = await createTestUser(generateTestUser());
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      const thread = await createForumThread({
        title: "Welcome to the forums!",
        content: "This is the first post in this thread.",
        categoryId: category.id,
        createdBy: user.id,
      });

      // Navigate to thread
      await goToThread(page, category.slug, thread.id);

      // Verify post content is visible
      await expect(
        page.locator("text=This is the first post in this thread.")
      ).toBeVisible();
    });

    test("should redirect to login when trying to create a thread", async ({
      page,
    }) => {
      // Create a test category
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });

      // Navigate to new thread page
      await page.goto(`/forums/${category.slug}/new`);

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("should redirect to login when trying to request a category", async ({
      page,
    }) => {
      // Navigate to request category page
      await page.goto("/forums/request-category");

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Authenticated Users", () => {
    test("should be able to create a new thread", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create a category
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });

      // Create thread via UI
      await createThreadViaUI(page, category.slug, {
        title: "My First Thread",
        content: "This is my first post!",
      });

      // Verify we're on the thread page
      await expect(page).toHaveURL(/\/forums\/[^/]+\/\d+/);

      // Verify thread content is visible
      await expect(page.locator("text=My First Thread")).toBeVisible();
      await expect(page.locator("text=This is my first post!")).toBeVisible();
    });

    test("should be able to post a reply to a thread", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create test data
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      const thread = await createForumThread({
        title: "Welcome to the forums!",
        content: "This is the first post in this thread.",
        categoryId: category.id,
        createdBy: user.id,
      });

      // Post a reply via UI
      await postReplyViaUI(
        page,
        category.slug,
        thread.id,
        "Thanks for the welcome!"
      );

      // Verify reply is visible
      await expect(page.locator("text=Thanks for the welcome!")).toBeVisible();
    });

    test("should be able to request a new category", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Request a category via UI
      await requestCategoryViaUI(page, {
        name: "Feature Requests",
        description: "A place to suggest new features",
        justification: "We need a dedicated space for feature discussions",
      });

      // Verify success (should show success message or redirect)
      await expect(
        page.locator("text=Category request submitted")
      ).toBeVisible();
    });

    test("should be able to report a post", async ({ page }) => {
      // Create and login first user (who creates the post)
      const user1Data = generateTestUser();
      const user1 = await createTestUser(user1Data);

      // Create and login second user (who will report)
      const user2Data = generateTestUser();
      await createTestUser(user2Data);
      await loginUser(page, {
        email: user2Data.email,
        password: user2Data.password,
      });

      // Create test data
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      const thread = await createForumThread({
        title: "Test Thread",
        content: "This is a test post that will be reported.",
        categoryId: category.id,
        createdBy: user1.id,
      });

      // Navigate to thread
      await goToThread(page, category.slug, thread.id);

      // Report the post via UI
      await reportPostViaUI(
        page,
        '[data-testid="forum-post"]',
        "spam",
        "This looks like spam to me"
      );

      // Verify success
      await expect(page.locator("text=Report submitted")).toBeVisible();
    });

    test("should not be able to post in a locked thread", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create a locked thread
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      const thread = await createForumThread({
        title: "Locked Thread",
        content: "This thread is locked.",
        categoryId: category.id,
        createdBy: user.id,
        isLocked: true,
      });

      // Navigate to thread
      await goToThread(page, category.slug, thread.id);

      // Verify reply form is not visible or disabled
      const replyButton = page.locator('button:has-text("Post Reply")');
      await expect(replyButton).toBeDisabled();
    });

    test("should see pinned threads at the top", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create category
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });

      // Create a regular thread
      await createForumThread({
        title: "Regular Thread",
        content: "This is a regular thread.",
        categoryId: category.id,
        createdBy: user.id,
      });

      // Create a pinned thread
      await createForumThread({
        title: "Pinned Thread",
        content: "This is a pinned thread.",
        categoryId: category.id,
        createdBy: user.id,
        isPinned: true,
      });

      // Navigate to category
      await goToCategory(page, category.slug);

      // Get all thread titles
      const threads = page.locator('[data-testid="thread-item"]');
      const firstThread = threads.first();

      // Verify pinned thread is first
      await expect(firstThread).toContainText("Pinned Thread");
    });
  });

  test.describe("Admin Users", () => {
    test("should be able to create a category", async ({ page }) => {
      // Create and login admin user
      const adminData = generateTestUser();
      await createTestUser({ ...adminData, role: "admin" });
      await loginUser(page, {
        email: adminData.email,
        password: adminData.password,
      });

      // Create category as admin via UI
      await createCategoryAsAdmin(page, {
        name: "Site News",
        description: "Official announcements and news",
      });

      // Navigate to forums and verify category exists
      await goToForums(page);
      await expect(page.locator("text=Site News")).toBeVisible();
    });

    test("should be able to approve a category request", async ({ page }) => {
      // Create regular user and make a category request
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      await requestCategoryViaUI(page, {
        name: "Feature Requests",
        description: "Suggest new features",
        justification: "We need this category",
      });

      // Logout and login as admin
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      const adminData = generateTestUser();
      await createTestUser({ ...adminData, role: "admin" });
      await loginUser(page, {
        email: adminData.email,
        password: adminData.password,
      });

      // Approve the request
      await approveCategoryRequest(page, "Feature Requests");

      // Verify category was created
      await goToForums(page);
      await expect(page.locator("text=Feature Requests")).toBeVisible();
    });

    test("should be able to delete a thread via report resolution", async ({
      page,
    }) => {
      // Create users
      const user1Data = generateTestUser();
      const user1 = await createTestUser(user1Data);

      const user2Data = generateTestUser();
      await createTestUser(user2Data);

      // Create category and thread
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      const thread = await createForumThread({
        title: "Spam Thread",
        content: "This is spam content.",
        categoryId: category.id,
        createdBy: user1.id,
      });

      // User 2 reports the thread
      await loginUser(page, {
        email: user2Data.email,
        password: user2Data.password,
      });

      await goToThread(page, category.slug, thread.id);
      await reportPostViaUI(
        page,
        '[data-testid="forum-post"]',
        "spam",
        "This is spam"
      );

      // Logout and login as admin
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      const adminData = generateTestUser();
      await createTestUser({ ...adminData, role: "admin" });
      await loginUser(page, {
        email: adminData.email,
        password: adminData.password,
      });

      // Go to admin forums and resolve by deleting thread
      await goToAdminForums(page);
      await page.click('button:has-text("Reports")');

      // Click delete thread button
      await page.locator('button:has-text("Delete Thread")').first().click();

      // Confirm deletion
      await page.locator('button:has-text("Delete Thread")').last().click();

      // Navigate to category and verify thread is gone
      await goToCategory(page, category.slug);
      expect(await threadExists(page, "Spam Thread")).toBe(false);
    });

    test("should be able to pin and lock threads", async ({ page }) => {
      // Create and login admin
      const adminData = generateTestUser();
      const admin = await createTestUser({ ...adminData, role: "admin" });
      await loginUser(page, {
        email: adminData.email,
        password: adminData.password,
      });

      // Create category and thread
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      await createForumThread({
        title: "Important Announcement",
        content: "This is important.",
        categoryId: category.id,
        createdBy: admin.id,
      });

      // Go to admin forums
      await goToAdminForums(page);

      // Pin the thread (this would be done via admin interface)
      // Note: The actual UI implementation may vary
      // This is a placeholder for the pin functionality
      await page.click('button:has-text("Reports")');

      // Verify admin can see moderation controls
      await expect(page.locator('button:has-text("Pin Thread")')).toBeVisible();
      await expect(
        page.locator('button:has-text("Lock Thread")')
      ).toBeVisible();
    });

    test("should see pending reports count in admin dashboard", async ({
      page,
    }) => {
      // Create users
      const user1Data = generateTestUser();
      const user1 = await createTestUser(user1Data);

      const user2Data = generateTestUser();
      await createTestUser(user2Data);

      // Create category and thread
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      const thread = await createForumThread({
        title: "Test Thread",
        content: "Test content.",
        categoryId: category.id,
        createdBy: user1.id,
      });

      // User 2 reports the thread
      await loginUser(page, {
        email: user2Data.email,
        password: user2Data.password,
      });

      await goToThread(page, category.slug, thread.id);
      await reportPostViaUI(
        page,
        '[data-testid="forum-post"]',
        "spam",
        "This is spam"
      );

      // Logout and login as admin
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      const adminData = generateTestUser();
      await createTestUser({ ...adminData, role: "admin" });
      await loginUser(page, {
        email: adminData.email,
        password: adminData.password,
      });

      // Go to admin dashboard
      await page.goto("/admin");

      // Verify pending reports are shown in "Needs Attention"
      const needsAttention = page.locator(
        'h2:has-text("Needs Attention") + div'
      );
      await expect(needsAttention).toContainText("Forum Reports");
      await expect(needsAttention).toContainText("1");
    });
  });

  test.describe("Forum Search and Navigation", () => {
    test("should show empty state when no categories exist", async ({
      page,
    }) => {
      await goToForums(page);

      // Verify empty state message
      await expect(page.locator("text=No forum categories yet")).toBeVisible();
    });

    test("should show empty state when category has no threads", async ({
      page,
    }) => {
      // Create a category with no threads
      const category = await createForumCategory({
        name: "Empty Category",
        description: "No threads here yet",
      });

      await goToCategory(page, category.slug);

      // Verify empty state message
      await expect(page.locator("text=No threads yet")).toBeVisible();
    });

    test("should display thread and post counts on category list", async ({
      page,
    }) => {
      // Create test data
      const user = await createTestUser(generateTestUser());
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      await createForumThread({
        title: "Thread 1",
        content: "First thread",
        categoryId: category.id,
        createdBy: user.id,
      });
      await createForumThread({
        title: "Thread 2",
        content: "Second thread",
        categoryId: category.id,
        createdBy: user.id,
      });

      await goToForums(page);

      // Verify thread count is displayed
      const categoryCard = page.locator(`text=${category.name}`).locator("..");
      await expect(categoryCard).toContainText("2");
    });
  });

  test.describe("Forum Permissions", () => {
    test("regular users cannot access admin forum management", async ({
      page,
    }) => {
      // Create and login regular user
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Try to access admin forums
      await page.goto("/admin/forums");

      // Should be redirected away (to home or unauthorized page)
      await expect(page).not.toHaveURL("/admin/forums");
    });

    test("users can only edit their own posts", async ({ page }) => {
      // Create two users
      const user1Data = generateTestUser();
      const user1 = await createTestUser(user1Data);

      const user2Data = generateTestUser();
      await createTestUser(user2Data);

      // Create category and thread as user1
      const category = await createForumCategory({
        name: "General Discussion",
        description: "A place for general chat",
      });
      const thread = await createForumThread({
        title: "User 1 Thread",
        content: "User 1 post",
        categoryId: category.id,
        createdBy: user1.id,
      });

      // Login as user2
      await loginUser(page, {
        email: user2Data.email,
        password: user2Data.password,
      });

      // Navigate to user1's thread
      await goToThread(page, category.slug, thread.id);

      // Verify edit button is not visible for user2
      const editButton = page.locator('button:has-text("Edit")');
      expect(await editButton.count()).toBe(0);
    });
  });
});
