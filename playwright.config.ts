import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Testing Configuration
 *
 * See https://playwright.dev/docs/test-configuration
 */
const config = defineConfig({
  testDir: "./tests/e2e",

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env["CI"],

  // Retry on CI only
  retries: process.env["CI"] ? 2 : 0,

  // Use single worker to avoid database conflicts in tests
  // Our tests share a database and use cleanDatabase() which can interfere when parallel
  workers: 1,

  // Reporter to use
  reporter: [["html"], ["list"], process.env["CI"] ? ["github"] : ["line"]],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] || "http://localhost:3000",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "retain-on-failure",
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // Uncomment to test on Firefox
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // Uncomment to test on WebKit (Safari)
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },

    // Uncomment to test on mobile viewports
    // {
    //   name: "Mobile Chrome",
    //   use: { ...devices["Pixel 5"] },
    // },
    // {
    //   name: "Mobile Safari",
    //   use: { ...devices["iPhone 12"] },
    // },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 120000, // 2 minutes for Next.js to start
    env: {
      // Disable rate limiting for E2E tests to prevent authentication failures
      PLAYWRIGHT_E2E_TESTING: "true",
      // Use test database for E2E tests
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/cityforge_test",
      JWT_SECRET_KEY: "test_jwt_secret_key_for_e2e_tests",
    },
  },
});

export default config;
