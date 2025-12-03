import { Page } from "@playwright/test";

/**
 * E2E Test Helpers for Authentication
 */

// Store shared test user for avoiding rate limiting
let sharedTestUser: {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
} | null = null;

/**
 * Get or create a shared test user to avoid rate limiting issues
 * This user is reused across tests in a single test file
 * Uses API registration to ensure server Prisma connection is aware
 */
export async function getOrCreateSharedTestUser() {
  if (!sharedTestUser) {
    const userData = generateTestUser();
    const dbUser = await createTestUserViaAPI(userData);
    sharedTestUser = {
      id: dbUser.id,
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
    };
  }
  return sharedTestUser;
}

/**
 * Create a test user via API registration instead of direct database insertion
 * This ensures the Next.js server's Prisma connection is aware of the user
 */
export async function createTestUserViaAPI(userData: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}): Promise<{
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}> {
  // Make API call to register endpoint
  const response = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      first_name: userData.firstName,
      last_name: userData.lastName,
      confirm_password: userData.password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create test user via API: ${response.status} ${errorText}`
    );
  }

  const result = await response.json();

  return {
    id: result.user.id,
    email: userData.email,
    password: userData.password,
    firstName: userData.firstName,
    lastName: userData.lastName,
  };
}

/**
 * Clear the shared test user (call this in test cleanup)
 */
export function clearSharedTestUser() {
  sharedTestUser = null;
}

/**
 * Login using the shared test user to avoid rate limiting
 */
export async function loginWithSharedUser(page: Page) {
  const user = await getOrCreateSharedTestUser();
  await loginUser(page, {
    email: user.email,
    password: user.password,
  });
  return user;
}

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
 * Login a user and handle rate limiting
 * Automatically retries with delays if rate limited
 */
export async function loginUser(
  page: Page,
  credentials: {
    email: string;
    password: string;
  }
) {
  const maxRetries = 2; // Reduced retries
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;

    try {
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

      // Check if login failed due to rate limiting
      if (statusCode === 429) {
        // For e2e tests, we need shorter waits to avoid timeouts
        // Wait only 10 seconds instead of 65, and if still rate limited, fail fast
        await page.waitForTimeout(10000);

        if (attempt === maxRetries) {
          throw new Error("Authentication rate limited - test cannot proceed");
        }
        continue;
      }

      // Check if login failed for other reasons
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

      // Successful login
      console.log("Authentication successful after attempts:", { attempt });
      // Wait for successful authentication and dashboard access
      await waitForAuthentication(page);
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log("Login attempt failed:", { attempt, error });
      // Wait a bit before retrying
      await page.waitForTimeout(2000);
    }
  }
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
