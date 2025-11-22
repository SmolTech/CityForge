import { test, expect } from "@playwright/test";
import {
  registerUser,
  loginUser,
  logoutUser,
  generateTestUser,
  isLoggedIn,
} from "./helpers/auth";
import {
  cleanDatabase,
  createTestUser,
  disconnectDatabase,
} from "./helpers/database";

/**
 * E2E Tests for Authentication Flow
 *
 * Tests the complete user journey for registration, login, and logout
 */

test.describe("Authentication E2E", () => {
  // Clean database before each test for isolation
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  // Clean up after all tests
  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test("should register a new user successfully", async ({ page }) => {
    const userData = generateTestUser();

    await registerUser(page, userData);

    // Verify we're on the dashboard
    await expect(page).toHaveURL("/dashboard");

    // Verify user is logged in
    expect(await isLoggedIn(page)).toBe(true);

    // Check if email verification banner appears (optional since it depends on email verification status)
    const banner = page.locator('[data-testid="email-verification-banner"]');
    const bannerVisible = await banner.isVisible().catch(() => false);

    if (bannerVisible) {
      // If banner is visible, verify it's properly displayed
      await expect(banner).toBeVisible();
    } else {
      // If no banner, verify we can access dashboard content instead
      await expect(page.locator("h1")).toContainText("Your Dashboard");
    }
  });

  test("should login with existing user", async ({ page }) => {
    // Create a test user in the database
    const userData = generateTestUser();
    await createTestUser(userData);

    // Login via UI
    await loginUser(page, {
      email: userData.email,
      password: userData.password,
    });

    // Verify we're on the dashboard
    await expect(page).toHaveURL("/dashboard");

    // Verify user is logged in
    expect(await isLoggedIn(page)).toBe(true);
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in invalid credentials
    await page.fill('input[name="email"]', "nonexistent@example.com");
    await page.fill('input[name="password"]', "wrongpassword");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    const errorMessage = page.locator('[data-testid="login-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/invalid email or password/i);

    // Verify we're still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("should logout successfully", async ({ page }) => {
    // Create and login a user
    const userData = generateTestUser();
    await createTestUser(userData);
    await loginUser(page, {
      email: userData.email,
      password: userData.password,
    });

    // Verify logged in
    expect(await isLoggedIn(page)).toBe(true);

    // Logout
    await logoutUser(page);

    // Verify logged out
    expect(await isLoggedIn(page)).toBe(false);

    // Verify redirected to home or login
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test("should validate registration form fields", async ({ page }) => {
    await page.goto("/register");

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Wait a moment for any potential form submission
    await page.waitForTimeout(1000);

    // Since the form uses HTML5 validation with required fields,
    // we should still be on the registration page (form submission blocked)
    await expect(page).toHaveURL(/\/register/);

    // The form should not submit successfully with empty required fields
    // (HTML5 validation prevents submission, so no redirect to dashboard occurs)
  });

  test("should validate password strength", async ({ page }) => {
    await page.goto("/register");

    const userData = generateTestUser();

    // Fill in form with weak password
    await page.fill('input[name="email"]', userData.email);
    await page.fill('input[name="first_name"]', userData.firstName);
    await page.fill('input[name="last_name"]', userData.lastName);
    await page.fill('input[name="password"]', "weak");
    await page.fill('input[name="confirmPassword"]', "weak");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message about weak password
    const errorMessage = page.locator('[data-testid="register-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/password/i);
  });

  test("should handle duplicate email registration", async ({ page }) => {
    const userData = generateTestUser();

    // Create user in database
    await createTestUser(userData);

    // Try to register with same email
    await page.goto("/register");
    await page.fill('input[name="email"]', userData.email);
    await page.fill('input[name="first_name"]', userData.firstName);
    await page.fill('input[name="last_name"]', userData.lastName);
    await page.fill('input[name="password"]', userData.password);
    await page.fill('input[name="confirmPassword"]', userData.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message about duplicate email
    const errorMessage = page.locator('[data-testid="register-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/already registered/i);
  });
});
