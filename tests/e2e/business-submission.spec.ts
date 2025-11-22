import { test, expect } from "@playwright/test";
import { loginUser, generateTestUser } from "./helpers/auth";
import {
  cleanDatabase,
  createTestUser,
  disconnectDatabase,
} from "./helpers/database";

/**
 * E2E Tests for Business Submission Flow
 *
 * Tests the complete user journey for submitting a business card
 */

test.describe("Business Submission E2E", () => {
  // Clean database before each test for isolation
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  // Clean up after all tests
  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test("should submit a new business card", async ({ page }) => {
    // Create and login a user
    const userData = generateTestUser();
    await createTestUser({ ...userData, emailVerified: true });
    await loginUser(page, {
      email: userData.email,
      password: userData.password,
    });

    // Navigate to submission form
    await page.goto("/submit");

    // Fill in business card form
    await page.fill('input[name="name"]', "My Test Business");
    await page.fill(
      'textarea[name="description"]',
      "This is a test business description"
    );
    await page.fill('input[name="address"]', "123 Test St");
    await page.fill('input[name="phone"]', "555-1234");
    await page.fill('input[name="email"]', "business@example.com");
    await page.fill('input[name="website"]', "https://example.com");

    // Add tags
    const tagInput = page.locator('[data-testid="tag-input"]');
    await tagInput.fill("restaurant");
    await page.keyboard.press("Enter");
    await tagInput.fill("food");
    await page.keyboard.press("Enter");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success message
    const successMessage = page.locator('[role="alert"]');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText(/submitted/i);
  });

  test("should validate required fields", async ({ page }) => {
    // Create and login a user
    const userData = generateTestUser();
    await createTestUser({ ...userData, emailVerified: true });
    await loginUser(page, {
      email: userData.email,
      password: userData.password,
    });

    // Navigate to submission form
    await page.goto("/submit");

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Check for validation errors
    const nameError = page.locator('[data-testid="name-error"]');
    const descriptionError = page.locator('[data-testid="description-error"]');

    // At least one validation error should be visible
    const anyErrorVisible =
      (await nameError.isVisible()) || (await descriptionError.isVisible());

    expect(anyErrorVisible).toBe(true);
  });

  test("should require authentication to submit", async ({ page }) => {
    // Try to access submit page without login
    await page.goto("/submit");

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("should validate email format", async ({ page }) => {
    // Create and login a user
    const userData = generateTestUser();
    await createTestUser({ ...userData, emailVerified: true });
    await loginUser(page, {
      email: userData.email,
      password: userData.password,
    });

    // Navigate to submission form
    await page.goto("/submit");

    // Fill in form with invalid email
    await page.fill('input[name="name"]', "Test Business");
    await page.fill('input[name="description"]', "Test description");
    await page.fill('input[name="email"]', "invalid-email");

    // Submit form
    await page.click('button[type="submit"]');

    // Check for email validation error
    const emailError = page.locator('[data-testid="email-error"]');
    const anyError = page.locator('[role="alert"]');

    // Either field-level or form-level error should be visible
    const errorVisible =
      (await emailError.isVisible()) || (await anyError.isVisible());

    expect(errorVisible).toBe(true);
  });

  test("should validate website URL format", async ({ page }) => {
    // Create and login a user
    const userData = generateTestUser();
    await createTestUser({ ...userData, emailVerified: true });
    await loginUser(page, {
      email: userData.email,
      password: userData.password,
    });

    // Navigate to submission form
    await page.goto("/submit");

    // Fill in form with invalid website URL
    await page.fill('input[name="name"]', "Test Business");
    await page.fill('input[name="description"]', "Test description");
    await page.fill('input[name="website"]', "not-a-url");

    // Submit form
    await page.click('button[type="submit"]');

    // Check for website validation error
    const websiteError = page.locator('[data-testid="website-error"]');
    const anyError = page.locator('[role="alert"]');

    // Either field-level or form-level error should be visible
    const errorVisible =
      (await websiteError.isVisible()) || (await anyError.isVisible());

    expect(errorVisible).toBe(true);
  });

  test("should allow user to edit draft before submission", async ({
    page,
  }) => {
    // Create and login a user
    const userData = generateTestUser();
    await createTestUser({ ...userData, emailVerified: true });
    await loginUser(page, {
      email: userData.email,
      password: userData.password,
    });

    // Navigate to submission form
    await page.goto("/submit");

    // Fill in initial data
    await page.fill('input[name="name"]', "Initial Name");
    await page.fill('input[name="description"]', "Initial description");

    // Edit the name
    await page.fill('input[name="name"]', "Updated Name");

    // Verify the field was updated
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toHaveValue("Updated Name");
  });
});
