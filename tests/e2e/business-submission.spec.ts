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
    await page.fill('input[name="phone_number"]', "555-1234");
    await page.fill('input[name="email"]', "business@example.com");
    await page.fill('input[name="website_url"]', "https://example.com");

    // Add tags
    const tagInput = page.locator('[data-testid="tag-input"]');
    await tagInput.fill("restaurant");
    await page.keyboard.press("Enter");
    await tagInput.fill("food");
    await page.keyboard.press("Enter");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success message
    const successMessage = page.locator('[data-testid="submit-success"]');
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

    // Try to submit form with empty required field (name)
    await page.click('button[type="submit"]');

    // Check that HTML5 validation prevents submission
    // The form should not submit and we should still be on the submit page
    await expect(page).toHaveURL(/\/submit/);

    // Check that the required field has validation state
    const nameInput = page.locator('input[name="name"]');
    const isValid = await nameInput.evaluate(
      (input: HTMLInputElement) => input.validity.valid
    );
    expect(isValid).toBe(false);
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

    // Fill in form with valid name and invalid email
    await page.fill('input[name="name"]', "Test Business");
    await page.fill('input[name="email"]', "invalid-email");

    // Submit form
    await page.click('button[type="submit"]');

    // Check that HTML5 validation prevents submission due to invalid email
    await expect(page).toHaveURL(/\/submit/);

    // Check that the email field has validation state
    const emailInput = page.locator('input[name="email"]');
    const isValid = await emailInput.evaluate(
      (input: HTMLInputElement) => input.validity.valid
    );
    expect(isValid).toBe(false);
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

    // Fill in form with valid name and invalid website URL
    await page.fill('input[name="name"]', "Test Business");
    await page.fill('input[name="website_url"]', "not-a-url");

    // Submit form
    await page.click('button[type="submit"]');

    // Check that HTML5 validation prevents submission due to invalid URL
    await expect(page).toHaveURL(/\/submit/);

    // Check that the website URL field has validation state
    const websiteInput = page.locator('input[name="website_url"]');
    const isValid = await websiteInput.evaluate(
      (input: HTMLInputElement) => input.validity.valid
    );
    expect(isValid).toBe(false);
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
    await page.fill('textarea[name="description"]', "Initial description");

    // Edit the name
    await page.fill('input[name="name"]', "Updated Name");

    // Verify the field was updated
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toHaveValue("Updated Name");
  });
});
