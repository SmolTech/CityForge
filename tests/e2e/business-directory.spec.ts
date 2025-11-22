import { test, expect } from "@playwright/test";
import { generateTestUser } from "./helpers/auth";
import {
  cleanDatabase,
  createTestUser,
  createTestCard,
  disconnectDatabase,
} from "./helpers/database";

/**
 * E2E Tests for Business Directory
 *
 * Tests the complete user journey for browsing and searching businesses
 */

test.describe("Business Directory E2E", () => {
  // Clean database before each test for isolation
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  // Clean up after all tests
  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test("should display business cards on directory page", async ({ page }) => {
    // Create test user and cards
    const user = await createTestUser({
      ...generateTestUser(),
      emailVerified: true,
    });

    await createTestCard({
      name: "Test Restaurant",
      description: "A great place to eat",
      createdBy: user.id,
      tags: ["restaurant", "food"],
      status: "approved",
    });

    await createTestCard({
      name: "Test Cafe",
      description: "Coffee and pastries",
      createdBy: user.id,
      tags: ["cafe", "coffee"],
      status: "approved",
    });

    // Visit business directory
    await page.goto("/");

    // Wait for cards to load
    await page.waitForSelector('[data-testid="business-card"]', {
      timeout: 10000,
    });

    // Verify cards are displayed
    const cards = page.locator('[data-testid="business-card"]');
    await expect(cards).toHaveCount(2);

    // Verify card content
    await expect(page.getByText("Test Restaurant")).toBeVisible();
    await expect(page.getByText("Test Cafe")).toBeVisible();
  });

  test("should filter businesses by tag", async ({ page }) => {
    // Create test user and cards with different tags
    const user = await createTestUser({
      ...generateTestUser(),
      emailVerified: true,
    });

    await createTestCard({
      name: "Italian Restaurant",
      description: "Authentic Italian cuisine",
      createdBy: user.id,
      tags: ["restaurant", "italian"],
      status: "approved",
    });

    await createTestCard({
      name: "Coffee Shop",
      description: "Artisan coffee",
      createdBy: user.id,
      tags: ["cafe", "coffee"],
      status: "approved",
    });

    // Visit business directory
    await page.goto("/");

    // Wait for cards to load
    await page.waitForSelector('[data-testid="business-card"]');

    // Click on "restaurant" tag
    const restaurantTag = page
      .locator('[data-testid="tag-restaurant"]')
      .first();
    await restaurantTag.click();

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Verify only restaurant is shown
    const cards = page.locator('[data-testid="business-card"]');
    await expect(cards).toHaveCount(1);
    await expect(page.getByText("Italian Restaurant")).toBeVisible();
    await expect(page.getByText("Coffee Shop")).not.toBeVisible();
  });

  test("should navigate to business detail page", async ({ page }) => {
    // Create test user and card
    const user = await createTestUser({
      ...generateTestUser(),
      emailVerified: true,
    });

    const card = await createTestCard({
      name: "Detail Test Business",
      description: "Click to see details",
      createdBy: user.id,
      tags: ["test"],
      status: "approved",
    });

    // Visit business directory
    await page.goto("/");

    // Wait for cards to load
    await page.waitForSelector('[data-testid="business-card"]');

    // Click on the card
    const cardElement = page.locator('[data-testid="business-card"]').first();
    await cardElement.click();

    // Verify redirected to detail page
    await expect(page).toHaveURL(new RegExp(`/business/${card.id}`));

    // Verify business details are shown (be specific about which element)
    await expect(
      page.getByRole("heading", { name: "Detail Test Business" })
    ).toBeVisible();
    await expect(page.getByText("Click to see details")).toBeVisible();
  });

  test("should paginate business listings", async ({ page }) => {
    // Create test user and many cards
    const user = await createTestUser({
      ...generateTestUser(),
      emailVerified: true,
    });

    // Create 25 cards to ensure pagination (assuming 20 per page)
    for (let i = 1; i <= 25; i++) {
      await createTestCard({
        name: `Business ${i}`,
        description: `Description ${i}`,
        createdBy: user.id,
        status: "approved",
      });
    }

    // Visit business directory
    await page.goto("/");

    // Wait for cards to load
    await page.waitForSelector('[data-testid="business-card"]');

    // Verify first page has max 20 cards
    const firstPageCards = page.locator('[data-testid="business-card"]');
    const firstPageCount = await firstPageCards.count();
    expect(firstPageCount).toBeLessThanOrEqual(20);

    // Find and click next page button
    const nextButton = page.locator('[data-testid="pagination-next"]');
    if (await nextButton.isVisible()) {
      await nextButton.click();

      // Wait for page to update
      await page.waitForTimeout(1000);

      // Verify we have cards on second page
      const secondPageCards = page.locator('[data-testid="business-card"]');
      await expect(secondPageCards.first()).toBeVisible();
    }
  });

  test("should search businesses", async ({ page }) => {
    // Create test user and cards
    const user = await createTestUser({
      ...generateTestUser(),
      emailVerified: true,
    });

    await createTestCard({
      name: "Unique Pizza Place",
      description: "Best pizza in town",
      createdBy: user.id,
      tags: ["restaurant", "pizza"],
      status: "approved",
    });

    await createTestCard({
      name: "Generic Cafe",
      description: "Regular coffee",
      createdBy: user.id,
      tags: ["cafe"],
      status: "approved",
    });

    // Visit business directory
    await page.goto("/");

    // Wait for search input
    await page.waitForSelector('[data-testid="search-input"]');

    // Search for "pizza"
    await page.fill('[data-testid="search-input"]', "pizza");

    // Wait for search results
    await page.waitForTimeout(1000);

    // Verify only pizza place is shown
    await expect(page.getByText("Unique Pizza Place")).toBeVisible();
    await expect(page.getByText("Generic Cafe")).not.toBeVisible();
  });

  test("should show empty state when no businesses", async ({ page }) => {
    // Visit business directory with no cards (home page is the business directory)
    await page.goto("/");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Verify empty state message
    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
  });
});
