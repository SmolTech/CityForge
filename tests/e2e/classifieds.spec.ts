import { test, expect } from "@playwright/test";
import { loginUser, generateTestUser } from "./helpers/auth";
import {
  cleanDatabase,
  disconnectDatabase,
  createTestUser,
} from "./helpers/database";
import {
  createHelpWantedPost,
  createHelpWantedComment,
  goToClassifieds,
  goToClassifiedPost,
  createClassifiedViaUI,
  updateClassifiedViaUI,
  deleteClassifiedViaUI,
  postCommentViaUI,
  reportClassifiedViaUI,
  filterByCategory,
  filterByStatus,
  searchClassifieds,
  classifiedExists,
  commentExists,
  getPostCount,
} from "./helpers/classifieds";

/**
 * E2E Tests for Classifieds (Help Wanted)
 *
 * Tests the complete user journey for classifieds functionality including:
 * - Viewing classified posts
 * - Creating and managing posts
 * - Commenting on posts
 * - Filtering and searching
 * - Reporting posts
 * - Admin moderation
 */

test.describe("Classifieds E2E", () => {
  // Clean database before each test for isolation
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  // Clean up after all tests
  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test.describe("Anonymous Users", () => {
    test("should be able to view classified posts", async ({ page }) => {
      // Create test data
      const user = await createTestUser(generateTestUser());
      const post = await createHelpWantedPost({
        title: "Need help with landscaping",
        description: "Looking for someone to help with yard work",
        category: "hiring",
        createdBy: user.id,
      });

      // Navigate to classifieds
      await goToClassifieds(page);

      // Verify post is visible
      await expect(page.locator(`text=${post.title}`)).toBeVisible();
      await expect(
        page.locator("text=Looking for someone to help with yard work")
      ).toBeVisible();
    });

    test("should be able to view a specific classified post", async ({
      page,
    }) => {
      // Create test data
      const user = await createTestUser(generateTestUser());
      const post = await createHelpWantedPost({
        title: "Web Developer Needed",
        description: "Looking for a skilled web developer",
        category: "hiring",
        createdBy: user.id,
        budget: "$5000",
        location: "Remote",
      });

      // Navigate to post
      await goToClassifiedPost(page, post.id);

      // Verify post details are visible
      await expect(page.locator(`text=${post.title}`)).toBeVisible();
      await expect(
        page.locator("text=Looking for a skilled web developer")
      ).toBeVisible();
      await expect(page.locator("text=$5000")).toBeVisible();
      await expect(page.locator("text=Remote")).toBeVisible();
    });

    test("should redirect to login when trying to create a post", async ({
      page,
    }) => {
      // Navigate to new post page
      await page.goto("/classifieds/new");

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("should be able to filter posts by category", async ({ page }) => {
      // Create test data
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "Hiring Post",
        description: "Hiring for a job",
        category: "hiring",
        createdBy: user.id,
      });
      await createHelpWantedPost({
        title: "Collaboration Post",
        description: "Looking for collaborators",
        category: "collaboration",
        createdBy: user.id,
      });

      // Filter by hiring category
      await filterByCategory(page, "hiring");

      // Verify only hiring posts are visible
      expect(await classifiedExists(page, "Hiring Post")).toBe(true);
      expect(await classifiedExists(page, "Collaboration Post")).toBe(false);
    });

    test("should be able to search posts", async ({ page }) => {
      // Create test data
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "Web Development",
        description: "Need a web developer",
        category: "hiring",
        createdBy: user.id,
      });
      await createHelpWantedPost({
        title: "Gardening Help",
        description: "Need help with my garden",
        category: "general",
        createdBy: user.id,
      });

      // Search for "web"
      await searchClassifieds(page, "web");

      // Verify search results
      expect(await classifiedExists(page, "Web Development")).toBe(true);
      expect(await classifiedExists(page, "Gardening Help")).toBe(false);
    });

    test("should show empty state when no posts exist", async ({ page }) => {
      await goToClassifieds(page);

      // Verify empty state message
      await expect(page.locator("text=No posts found")).toBeVisible();
      await expect(
        page.locator("text=Be the first to post a classified request!")
      ).toBeVisible();
    });
  });

  test.describe("Authenticated Users", () => {
    test("should be able to create a new classified post", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create post via UI
      await createClassifiedViaUI(page, {
        title: "Looking for React Developer",
        description:
          "Need an experienced React developer for a 3-month project",
        category: "hiring",
        location: "Remote",
        budget: "$10,000",
        contactPreference: "email",
      });

      // Verify we're on the post page
      await expect(page).toHaveURL(/\/classifieds\/\d+/);

      // Verify post content is visible
      await expect(
        page.locator("text=Looking for React Developer")
      ).toBeVisible();
      await expect(
        page.locator("text=Need an experienced React developer")
      ).toBeVisible();
    });

    test("should be able to update their own post", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create a post
      const post = await createHelpWantedPost({
        title: "Original Title",
        description: "Original description",
        category: "hiring",
        createdBy: user.id,
      });

      // Update post via UI
      await updateClassifiedViaUI(page, post.id, {
        title: "Updated Title",
        description: "Updated description",
        status: "closed",
      });

      // Verify updates are visible
      await expect(page.locator("text=Updated Title")).toBeVisible();
      await expect(page.locator("text=Updated description")).toBeVisible();
      await expect(page.locator("text=Closed")).toBeVisible();
    });

    test("should be able to delete their own post", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create a post
      const post = await createHelpWantedPost({
        title: "Post to Delete",
        description: "This will be deleted",
        category: "general",
        createdBy: user.id,
      });

      // Delete post via UI
      await deleteClassifiedViaUI(page, post.id);

      // Verify we're back on classifieds page
      await expect(page).toHaveURL("/classifieds");

      // Verify post is no longer visible
      expect(await classifiedExists(page, "Post to Delete")).toBe(false);
    });

    test("should be able to post a comment on a classified", async ({
      page,
    }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create a post
      const post = await createHelpWantedPost({
        title: "Post with Comments",
        description: "This post will have comments",
        category: "general",
        createdBy: user.id,
      });

      // Post a comment via UI
      await postCommentViaUI(
        page,
        post.id,
        "This sounds interesting! I'd like to help."
      );

      // Verify comment is visible
      await expect(
        page.locator("text=This sounds interesting! I'd like to help.")
      ).toBeVisible();
    });

    test("should be able to report a classified post", async ({ page }) => {
      // Create two users
      const user1Data = generateTestUser();
      const user1 = await createTestUser(user1Data);

      const user2Data = generateTestUser();
      await createTestUser(user2Data);
      await loginUser(page, {
        email: user2Data.email,
        password: user2Data.password,
      });

      // Create a post as user1
      const post = await createHelpWantedPost({
        title: "Suspicious Post",
        description: "This looks like spam",
        category: "general",
        createdBy: user1.id,
      });

      // Report the post as user2
      await reportClassifiedViaUI(
        page,
        post.id,
        "spam",
        "This is clearly spam"
      );

      // Verify success message
      await expect(page.locator("text=Report submitted")).toBeVisible();
    });

    test("should not be able to edit other users' posts", async ({ page }) => {
      // Create two users
      const user1Data = generateTestUser();
      const user1 = await createTestUser(user1Data);

      const user2Data = generateTestUser();
      await createTestUser(user2Data);
      await loginUser(page, {
        email: user2Data.email,
        password: user2Data.password,
      });

      // Create a post as user1
      const post = await createHelpWantedPost({
        title: "User 1 Post",
        description: "Created by user 1",
        category: "general",
        createdBy: user1.id,
      });

      // Navigate to post as user2
      await goToClassifiedPost(page, post.id);

      // Verify edit button is not visible
      const editButton = page.locator('button:has-text("Edit")');
      expect(await editButton.count()).toBe(0);
    });

    test("should be able to filter by status", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create posts with different statuses
      await createHelpWantedPost({
        title: "Open Post",
        description: "This is open",
        category: "general",
        createdBy: user.id,
        status: "open",
      });
      await createHelpWantedPost({
        title: "Closed Post",
        description: "This is closed",
        category: "general",
        createdBy: user.id,
        status: "closed",
      });

      // Filter by open status
      await filterByStatus(page, "open");

      // Verify only open posts are visible
      expect(await classifiedExists(page, "Open Post")).toBe(true);
      expect(await classifiedExists(page, "Closed Post")).toBe(false);
    });

    test("should display comment count correctly", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Create a post
      const post = await createHelpWantedPost({
        title: "Post with Comments",
        description: "This has comments",
        category: "general",
        createdBy: user.id,
      });

      // Add comments
      await createHelpWantedComment({
        postId: post.id,
        content: "First comment",
        createdBy: user.id,
      });
      await createHelpWantedComment({
        postId: post.id,
        content: "Second comment",
        createdBy: user.id,
      });

      // Navigate to classifieds list
      await goToClassifieds(page);

      // Verify comment count is displayed
      await expect(page.locator("text=2 comments")).toBeVisible();
    });
  });

  test.describe("Search and Filters", () => {
    test("should search by title", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "React Developer Position",
        description: "Looking for React dev",
        category: "hiring",
        createdBy: user.id,
      });

      await searchClassifieds(page, "React");

      await expect(page.locator("text=Found 1 result")).toBeVisible();
      expect(await classifiedExists(page, "React Developer Position")).toBe(
        true
      );
    });

    test("should search by description", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "Help Needed",
        description: "Need help with Angular development",
        category: "general",
        createdBy: user.id,
      });

      await searchClassifieds(page, "Angular");

      await expect(page.locator("text=Found 1 result")).toBeVisible();
      expect(await classifiedExists(page, "Help Needed")).toBe(true);
    });

    test("should search by location", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "Local Job",
        description: "Job description",
        category: "hiring",
        createdBy: user.id,
        location: "San Francisco",
      });

      await searchClassifieds(page, "San Francisco");

      await expect(page.locator("text=Found 1 result")).toBeVisible();
      expect(await classifiedExists(page, "Local Job")).toBe(true);
    });

    test("should combine category filter and search", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "Hiring Developer",
        description: "Need developer",
        category: "hiring",
        createdBy: user.id,
      });
      await createHelpWantedPost({
        title: "Developer Collaboration",
        description: "Looking for partners",
        category: "collaboration",
        createdBy: user.id,
      });

      // Apply category filter
      await filterByCategory(page, "hiring");

      // Then search
      await page.fill('input[placeholder*="Search"]', "Developer");
      await page.waitForTimeout(500);

      // Should only show hiring post
      expect(await classifiedExists(page, "Hiring Developer")).toBe(true);
      expect(await classifiedExists(page, "Developer Collaboration")).toBe(
        false
      );
    });

    test("should show correct count with filters applied", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      // Create 3 hiring posts
      for (let i = 1; i <= 3; i++) {
        await createHelpWantedPost({
          title: `Hiring Post ${i}`,
          description: `Description ${i}`,
          category: "hiring",
          createdBy: user.id,
        });
      }
      // Create 2 collaboration posts
      for (let i = 1; i <= 2; i++) {
        await createHelpWantedPost({
          title: `Collaboration Post ${i}`,
          description: `Description ${i}`,
          category: "collaboration",
          createdBy: user.id,
        });
      }

      // Filter by hiring
      await filterByCategory(page, "hiring");

      // Verify count
      const count = await getPostCount(page);
      expect(count).toBe(3);
    });
  });

  test.describe("Category Badges and Status", () => {
    test("should display category badge correctly", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "Hiring Post",
        description: "Job posting",
        category: "hiring",
        createdBy: user.id,
      });

      await goToClassifieds(page);

      // Verify category badge is visible
      await expect(page.locator("text=Hiring")).toBeVisible();
    });

    test("should display status badge correctly", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "Closed Post",
        description: "This is closed",
        category: "general",
        createdBy: user.id,
        status: "closed",
      });

      await goToClassifieds(page);

      // Verify status badge is visible
      await expect(page.locator("text=Closed")).toBeVisible();
    });

    test("should display all three categories", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      await createHelpWantedPost({
        title: "Hiring",
        description: "Hiring",
        category: "hiring",
        createdBy: user.id,
      });
      await createHelpWantedPost({
        title: "Collaboration",
        description: "Collab",
        category: "collaboration",
        createdBy: user.id,
      });
      await createHelpWantedPost({
        title: "General",
        description: "General",
        category: "general",
        createdBy: user.id,
      });

      await goToClassifieds(page);

      // Verify all category badges are visible
      await expect(page.locator("text=Hiring")).toBeVisible();
      await expect(page.locator("text=Collaboration")).toBeVisible();
      await expect(page.locator("text=General")).toBeVisible();
    });
  });

  test.describe("Post Details", () => {
    test("should display all post fields", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      const post = await createHelpWantedPost({
        title: "Complete Post",
        description: "Full description here",
        category: "hiring",
        createdBy: user.id,
        location: "New York",
        budget: "$1000-$2000",
      });

      await goToClassifiedPost(page, post.id);

      // Verify all fields are visible
      await expect(page.locator("text=Complete Post")).toBeVisible();
      await expect(page.locator("text=Full description here")).toBeVisible();
      await expect(page.locator("text=New York")).toBeVisible();
      await expect(page.locator("text=$1000-$2000")).toBeVisible();
    });

    test("should display creator information", async ({ page }) => {
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      const post = await createHelpWantedPost({
        title: "Post with Creator",
        description: "Created by test user",
        category: "general",
        createdBy: user.id,
      });

      await goToClassifiedPost(page, post.id);

      // Verify creator name is visible
      await expect(
        page.locator(`text=${userData.firstName} ${userData.lastName}`)
      ).toBeVisible();
    });

    test("should display creation date", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      const post = await createHelpWantedPost({
        title: "Dated Post",
        description: "Has a date",
        category: "general",
        createdBy: user.id,
      });

      await goToClassifiedPost(page, post.id);

      // Verify some date text is visible
      // Note: The exact format may vary, so we just check that the date section exists
      const postElement = page.locator('[data-testid="post-date"]');
      const exists = (await postElement.count()) > 0;
      // If the element doesn't have a test ID, we can check for "Posted by" text which includes the date
      if (!exists) {
        await expect(page.locator("text=Posted by")).toBeVisible();
      }
    });
  });

  test.describe("Comments", () => {
    test("should display existing comments", async ({ page }) => {
      const user = await createTestUser(generateTestUser());
      const post = await createHelpWantedPost({
        title: "Post with Existing Comments",
        description: "Has comments",
        category: "general",
        createdBy: user.id,
      });

      await createHelpWantedComment({
        postId: post.id,
        content: "Great opportunity!",
        createdBy: user.id,
      });

      await goToClassifiedPost(page, post.id);

      // Verify comment is visible
      await expect(page.locator("text=Great opportunity!")).toBeVisible();
    });

    test("should allow authenticated users to post comments", async ({
      page,
    }) => {
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      const post = await createHelpWantedPost({
        title: "Post for Commenting",
        description: "Post a comment here",
        category: "general",
        createdBy: user.id,
      });

      await postCommentViaUI(page, post.id, "I'm interested in this!");

      // Verify comment appears
      expect(await commentExists(page, "I'm interested in this!")).toBe(true);
    });
  });
});
