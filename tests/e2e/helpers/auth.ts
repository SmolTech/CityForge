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
  await page.fill('input[name="first_name"]', userData.firstName);
  await page.fill('input[name="last_name"]', userData.lastName);
  await page.fill('input[name="password"]', userData.password);
  await page.fill('input[name="confirmPassword"]', userData.password);

  // Wait for the API response after clicking submit
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/register") && response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for the registration API response
  const response = await responsePromise;
  const statusCode = response.status();

  // Check if registration failed
  if (statusCode !== 200 && statusCode !== 201) {
    // Wait a bit for error message to render
    await page.waitForTimeout(500);
    const errorElement = page.locator('[data-testid="register-error"]');
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      throw new Error("Registration failed with error: " + errorText);
    }
    throw new Error(`Registration failed with status code: ${statusCode}`);
  }

  // Wait for successful authentication and dashboard access
  await waitForAuthentication(page);
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

  // Wait for the API response after clicking submit
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") && response.status() !== 0,
    { timeout: 10000 }
  );

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for the login API response
  const response = await responsePromise;
  const statusCode = response.status();

  // Check if login failed
  if (statusCode !== 200) {
    // Wait a bit for error message to render
    await page.waitForTimeout(500);
    const errorElement = page.locator('[data-testid="login-error"]');
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      throw new Error("Login failed with error: " + errorText);
    }
    throw new Error(`Login failed with status code: ${statusCode}`);
  }

  // Wait for successful authentication and dashboard access
  await waitForAuthentication(page);
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
  try {
    // Navigate to dashboard and wait for it to load
    await page.goto("/dashboard", { timeout: 5000 });
    await page.waitForLoadState("networkidle", { timeout: 5000 });

    // If we stayed on the dashboard (not redirected to login), we're logged in
    return page.url().includes("/dashboard");
  } catch {
    return false;
  }
}

/**
 * Generate a unique test email
 */
export function generateTestEmail(): string {
  return (
    "e2e-test-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(7) +
    "@example.com"
  );
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

/**
 * Wait for authentication to complete and dashboard to be accessible
 */
export async function waitForAuthentication(page: Page, timeout = 15000) {
  const endTime = Date.now() + timeout;
  let attempts = 0;

  while (Date.now() < endTime) {
    attempts++;
    try {
      // Navigate to dashboard
      await page.goto("/dashboard", { timeout: 5000 });
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // If we're still on the dashboard (not redirected to login), we're authenticated
      if (page.url().includes("/dashboard")) {
        console.log("Authentication successful after attempts:", attempts);
        return;
      }

      // Log the current URL for debugging
      console.log("Authentication attempt details:", {
        attempt: attempts,
        currentUrl: page.url(),
      });

      // If we get redirected to login, wait a bit and try again
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log("Authentication attempt failed:", {
        attempt: attempts,
        error,
      });
      // If there's an error, wait a bit and try again
      await page.waitForTimeout(1000);
    }
  }

  throw new Error(
    "Authentication did not complete within timeout. Details: " +
      JSON.stringify({
        timeoutMs: timeout,
        attempts,
        currentUrl: page.url(),
      })
  );
}
