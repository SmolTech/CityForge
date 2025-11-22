# End-to-End (E2E) Testing with Playwright

This document describes the E2E testing setup for CityForge using Playwright.

## Overview

E2E tests verify that the entire application works correctly from a user's perspective by:

- Testing complete user journeys in a real browser
- Validating frontend and backend integration
- Ensuring critical workflows function correctly
- Catching issues that unit and integration tests might miss

## Technology Stack

- **Playwright**: Modern browser automation framework
- **Chromium**: Primary browser for E2E tests
- **TypeScript**: Type-safe test code
- **Testcontainers**: Isolated PostgreSQL database for tests (via integration test helpers)

## Setup and Installation

The required dependencies are already installed:

```json
{
  "devDependencies": {
    "@playwright/test": "^1.x"
  }
}
```

### Install Browsers

```bash
# Install Chromium browser
npx playwright install chromium

# Or install all browsers
npx playwright install
```

## Running E2E Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run with UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

### Run in Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

### Run Specific Test File

```bash
npm run test:e2e -- tests/e2e/auth.spec.ts
```

### Debug Tests

```bash
npm run test:e2e:debug
```

### View Test Report

```bash
npm run test:e2e:report
```

## Test Structure

```
tests/
└── e2e/
    ├── helpers/
    │   ├── auth.ts           # Authentication helpers
    │   └── database.ts       # Database setup helpers
    ├── auth.spec.ts          # Authentication flow tests
    ├── business-directory.spec.ts  # Business browsing tests
    └── business-submission.spec.ts # Business submission tests
```

## Test Helpers

### Authentication Helpers (`tests/e2e/helpers/auth.ts`)

```typescript
import {
  registerUser,
  loginUser,
  logoutUser,
  generateTestUser,
} from "./helpers/auth";

// Register a new user via UI
await registerUser(page, {
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  password: "TestPassword123!",
});

// Login existing user
await loginUser(page, {
  email: "test@example.com",
  password: "TestPassword123!",
});

// Logout current user
await logoutUser(page);

// Generate unique test user data
const userData = generateTestUser();
```

### Database Helpers (`tests/e2e/helpers/database.ts`)

```typescript
import {
  cleanDatabase,
  createTestUser,
  createTestCard,
} from "./helpers/database";

// Clean database before test
await cleanDatabase();

// Create test user
const user = await createTestUser({
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  password: "TestPassword123!",
  emailVerified: true, // Auto-verify for E2E tests
});

// Create test business card
const card = await createTestCard({
  name: "Test Business",
  description: "A test business",
  userId: user.id,
  tags: ["restaurant", "food"],
  status: "approved",
});
```

## Test Patterns

### Basic Test Structure

```typescript
import { test, expect } from "@playwright/test";
import { cleanDatabase, disconnectDatabase } from "./helpers/database";

test.describe("Feature Name", () => {
  // Clean database before each test
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  // Clean up after all tests
  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test("should do something", async ({ page }) => {
    // Navigate to page
    await page.goto("/page");

    // Interact with elements
    await page.fill('input[name="email"]', "test@example.com");
    await page.click('button[type="submit"]');

    // Assert expectations
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText("Success")).toBeVisible();
  });
});
```

### Finding Elements

```typescript
// By test ID (recommended)
page.locator('[data-testid="user-menu"]');

// By role
page.getByRole("button", { name: "Submit" });

// By text
page.getByText("Welcome");

// By label (for form inputs)
page.getByLabel("Email");

// By CSS selector
page.locator(".class-name");
```

### Waiting Strategies

```typescript
// Wait for URL change
await page.waitForURL("/dashboard");

// Wait for element to be visible
await page.waitForSelector('[data-testid="card"]');

// Wait for navigation to complete
await page.waitForLoadState("networkidle");

// Wait for specific timeout (avoid when possible)
await page.waitForTimeout(1000);
```

### Assertions

```typescript
// URL assertions
await expect(page).toHaveURL("/login");
await expect(page).toHaveURL(/\/business\/\d+/);

// Element visibility
await expect(element).toBeVisible();
await expect(element).not.toBeVisible();

// Text content
await expect(element).toContainText("Success");
await expect(element).toHaveText("Exact text");

// Form inputs
await expect(input).toHaveValue("test@example.com");

// Element count
await expect(cards).toHaveCount(5);
```

## Test Coverage

### ✅ Authentication Tests (`auth.spec.ts`)

- ✅ User registration
- ✅ User login
- ✅ User logout
- ✅ Invalid credentials handling
- ✅ Form validation
- ✅ Password strength validation
- ✅ Duplicate email handling

### ✅ Business Directory Tests (`business-directory.spec.ts`)

- ✅ Display business cards
- ✅ Filter by tags
- ✅ Navigate to business details
- ✅ Pagination
- ✅ Search functionality
- ✅ Empty state

### ✅ Business Submission Tests (`business-submission.spec.ts`)

- ✅ Submit new business card
- ✅ Form validation
- ✅ Authentication requirement
- ✅ Email format validation
- ✅ URL format validation
- ✅ Draft editing

## Best Practices

### 1. Test Isolation

Always clean the database before each test:

```typescript
test.beforeEach(async () => {
  await cleanDatabase();
});
```

### 2. Use data-testid for Stable Selectors

```typescript
// Good - stable across UI changes
await page.click('[data-testid="submit-button"]');

// Avoid - brittle, breaks with CSS changes
await page.click(".btn.btn-primary.submit");
```

### 3. Avoid Hard-Coded Waits

```typescript
// Good - wait for specific condition
await page.waitForSelector('[data-testid="success"]');

// Avoid - arbitrary timeout
await page.waitForTimeout(2000);
```

### 4. Use Unique Test Data

```typescript
// Good - unique email each test
const userData = generateTestUser();

// Avoid - same email across tests
await registerUser(page, { email: "test@example.com", ... });
```

### 5. Test One Thing Per Test

```typescript
// Good - focused test
test("should display validation error for invalid email", async ({ page }) => {
  // Test only email validation
});

// Avoid - testing multiple unrelated things
test("should validate all fields and submit and redirect", async ({ page }) => {
  // Too much in one test
});
```

## Configuration

### Playwright Config (`playwright.config.ts`)

Key settings:

- **testDir**: `./tests/e2e` - E2E test location
- **baseURL**: `http://localhost:3000` - Default app URL
- **webServer**: Automatically starts Next.js dev server
- **retries**: 2 retries on CI, 0 locally
- **workers**: 1 worker on CI, parallel locally

### Environment Variables

- `PLAYWRIGHT_BASE_URL`: Override base URL (default: http://localhost:3000)
- `DATABASE_URL`: Database connection string for test helpers

## Debugging

### Visual Debugging

```bash
# Run with UI mode
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Step through with debugger
npm run test:e2e:debug
```

### Screenshots and Videos

Playwright automatically captures:

- **Screenshots**: On test failure
- **Videos**: On test failure (retained)
- **Traces**: On first retry

View artifacts in `test-results/` directory.

### Console Logs

Add console logs in tests:

```typescript
test("debug test", async ({ page }) => {
  console.log("Current URL:", page.url());

  const element = page.locator('[data-testid="card"]');
  console.log("Element count:", await element.count());
});
```

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/frontend-ci.yml`:

```yaml
- name: Install Playwright
  run: npx playwright install chromium

- name: Run E2E Tests
  run: npm run test:e2e
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/cityforge_test

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests Fail on CI but Pass Locally

**Cause**: Different screen sizes or timing on CI

**Solution**:

- Add explicit waits for elements
- Use `waitForLoadState("networkidle")`
- Increase timeouts in `playwright.config.ts`

### Database Connection Errors

**Cause**: Wrong DATABASE_URL or database not running

**Solution**:

```bash
# Check DATABASE_URL is set correctly
echo $DATABASE_URL

# For local testing, ensure database is running
# E2E tests use same database as integration tests
```

### Element Not Found Errors

**Cause**: Element selector changed or timing issue

**Solution**:

- Use `data-testid` attributes for stable selectors
- Wait for element before interacting: `await page.waitForSelector()`
- Check if element is in viewport: `await element.scrollIntoViewIfNeeded()`

### Slow Test Execution

**Cause**: Too many waits or inefficient selectors

**Solution**:

- Remove hard-coded `waitForTimeout()` calls
- Use specific waits: `waitForSelector()` instead of `waitForTimeout()`
- Run tests in parallel (default locally)

## Performance

### Test Execution Time

- **Setup time**: ~2-3 seconds per test (database cleanup)
- **Average test**: ~3-5 seconds
- **Total suite**: ~30-45 seconds (for 20 tests)

### Optimization Tips

1. **Reuse authentication**: Use Playwright's `storageState` to save login session
2. **Skip UI for setup**: Use API calls or direct database inserts for test data
3. **Run in parallel**: Playwright runs tests in parallel by default (locally)

## Next Steps

1. **Add more E2E tests**:
   - Admin dashboard workflows
   - Forum functionality
   - Resource directory
   - User settings

2. **Visual regression testing**:
   - Add screenshot comparisons
   - Test responsive breakpoints

3. **Accessibility testing**:
   - Integrate axe-core with Playwright
   - Test keyboard navigation

4. **Performance testing**:
   - Add Lighthouse CI integration
   - Test page load times

## References

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Test Runner](https://playwright.dev/docs/test-runner)
- [CityForge Testing Improvements](./TESTING_IMPROVEMENTS.md)
