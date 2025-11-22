import { Page } from "@playwright/test";

/**
 * E2E Test Helpers for Authentication
 */

/**
 * Register a new user via the UI
 */
export async function registerUser(
  page: Page,
  userData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }
) {
  await page.goto("/register");

  // Fill in registration form
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="firstName"]', userData.firstName);
  await page.fill('input[name="lastName"]', userData.lastName);
  await page.fill('input[name="password"]', userData.password);
  await page.fill('input[name="confirmPassword"]', userData.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for registration to complete
  await page.waitForURL("/dashboard", { timeout: 10000 });
}

/**
 * Login a user via the UI
 */
export async function loginUser(
  page: Page,
  credentials: {
    email: string;
    password: string;
  }
) {
  await page.goto("/login");

  // Fill in login form
  await page.fill('input[name="email"]', credentials.email);
  await page.fill('input[name="password"]', credentials.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for login to complete
  await page.waitForURL("/dashboard", { timeout: 10000 });
}

/**
 * Logout the current user via the UI
 */
export async function logoutUser(page: Page) {
  // Click on user menu (navigation)
  await page.click('[data-testid="user-menu"]');

  // Click logout button
  await page.click('[data-testid="logout-button"]');

  // Wait for redirect to home or login
  await page.waitForURL(/\/(login)?$/, { timeout: 5000 });
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for user menu presence
  const userMenu = page.locator('[data-testid="user-menu"]');
  return await userMenu.isVisible();
}

/**
 * Generate a unique test email
 */
export function generateTestEmail(): string {
  return `e2e-test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Generate test user data
 */
export function generateTestUser() {
  return {
    email: generateTestEmail(),
    firstName: "Test",
    lastName: "User",
    password: "TestPassword123!",
  };
}
