import { test, expect } from "@playwright/test";
import { loginUser, generateTestUser } from "./helpers/auth";
import {
  cleanDatabase,
  disconnectDatabase,
  createTestUser,
} from "./helpers/database";
import { PrismaClient } from "@prisma/client";

/**
 * E2E Tests for Community Support (Forum Category Requests)
 *
 * These tests are specifically designed to reproduce and debug the issue where
 * category requests submitted on worcester.community are not appearing in the
 * admin interface.
 *
 * Tests cover:
 * - Category request form accessibility
 * - Authentication requirements
 * - Form submission process
 * - Database persistence
 * - Admin approval workflow
 * - Error handling and user feedback
 */

let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl:
        process.env["DATABASE_URL"] ||
        "postgresql://postgres:postgres@localhost:5432/cityforge_test",
    });
  }
  return prisma;
}

test.describe("Community Support - Category Requests", () => {
  // Clean database before each test for isolation
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  // Clean up after all tests
  test.afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    await disconnectDatabase();
  });

  test.describe("Form Access and Authentication", () => {
    test("should display category request form for authenticated users", async ({
      page,
    }) => {
      // Create and login user
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Navigate to category request form
      await page.goto("/forums/request-category");
      await page.waitForLoadState("networkidle");

      // Verify form elements are present and accessible
      await expect(page.locator('input[name="name"]')).toBeVisible();
      await expect(page.locator('textarea[name="description"]')).toBeVisible();
      await expect(
        page.locator('textarea[name="justification"]')
      ).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Verify form validation attributes
      await expect(page.locator('input[name="name"]')).toHaveAttribute(
        "required",
        ""
      );
      await expect(
        page.locator('textarea[name="description"]')
      ).toHaveAttribute("required", "");
      await expect(
        page.locator('textarea[name="justification"]')
      ).toHaveAttribute("required", "");

      // Verify character limits
      await expect(page.locator('input[name="name"]')).toHaveAttribute(
        "maxLength",
        "100"
      );
      await expect(
        page.locator('textarea[name="description"]')
      ).toHaveAttribute("maxLength", "500");
    });

    test("should redirect unauthenticated users to login", async ({ page }) => {
      // Try to access category request form without authentication
      await page.goto("/forums/request-category");

      // Should be redirected to login with redirect parameter
      await expect(page).toHaveURL(/\/login\?redirect=.*request-category/);
    });

    test("should preserve redirect URL after login", async ({ page }) => {
      // Create user
      const userData = generateTestUser();
      await createTestUser(userData);

      // Try to access category request form without authentication
      await page.goto("/forums/request-category");

      // Should be on login page with redirect
      await expect(page).toHaveURL(/\/login\?redirect=/);

      // Login with credentials
      await page.fill('input[name="email"]', userData.email);
      await page.fill('input[name="password"]', userData.password);
      await page.click('button[type="submit"]');

      // Should be redirected back to category request form
      await expect(page).toHaveURL("/forums/request-category");
      await expect(page.locator('input[name="name"]')).toBeVisible();
    });
  });

  test.describe("Form Validation", () => {
    test.beforeEach(async ({ page }) => {
      // Create and login user for all validation tests
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });
      await page.goto("/forums/request-category");
    });

    test("should validate required fields", async ({ page }) => {
      // Try to submit empty form
      await page.click('button[type="submit"]');

      // Check if browser validation prevents submission
      const nameField = page.locator('input[name="name"]');
      await expect(nameField).toHaveAttribute("required", "");

      // Check if submit button is disabled for empty form
      const submitButton = page.locator('button[type="submit"]');
      const isDisabled = await submitButton.isDisabled();
      expect(isDisabled).toBe(true);
    });

    test("should show character count for fields", async ({ page }) => {
      const testData = {
        name: "Community Health and Wellness",
        description:
          "A dedicated space for discussing health topics, wellness tips, and community health initiatives.",
        justification:
          "Our community has shown significant interest in health and wellness topics.",
      };

      // Fill fields and check character counts
      await page.fill('input[name="name"]', testData.name);
      await expect(page.locator("text=/\\d+\\/100 characters/")).toBeVisible();

      await page.fill('textarea[name="description"]', testData.description);
      await expect(page.locator("text=/\\d+\\/500 characters/")).toBeVisible();

      await page.fill('textarea[name="justification"]', testData.justification);
    });

    test("should enforce maximum character limits", async ({ page }) => {
      // Test name field limit (100 characters)
      const longName = "a".repeat(101);
      await page.fill('input[name="name"]', longName);

      // Verify the field only accepts 100 characters
      const nameValue = await page.locator('input[name="name"]').inputValue();
      expect(nameValue.length).toBeLessThanOrEqual(100);

      // Test description field limit (500 characters)
      const longDescription = "a".repeat(501);
      await page.fill('textarea[name="description"]', longDescription);

      const descriptionValue = await page
        .locator('textarea[name="description"]')
        .inputValue();
      expect(descriptionValue.length).toBeLessThanOrEqual(500);
    });

    test("should enable submit button when all fields are filled", async ({
      page,
    }) => {
      const testData = {
        name: "Community Events",
        description:
          "A place to organize and discuss community events and gatherings.",
        justification:
          "We need better coordination for local events and activities.",
      };

      // Initially submit button should be disabled
      const submitButton = page.locator('button[type="submit"]');
      expect(await submitButton.isDisabled()).toBe(true);

      // Fill all required fields
      await page.fill('input[name="name"]', testData.name);
      await page.fill('textarea[name="description"]', testData.description);
      await page.fill('textarea[name="justification"]', testData.justification);

      // Submit button should now be enabled
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe("Form Submission and Persistence", () => {
    test("should successfully submit a category request and persist to database", async ({
      page,
    }) => {
      // Create and login user
      const userData = generateTestUser();
      const user = await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Navigate to category request form
      await page.goto("/forums/request-category");

      const testRequest = {
        name: "Community Support",
        description:
          "A dedicated space for community members to seek and offer support, share resources, and help each other.",
        justification:
          "Many community members have expressed the need for a dedicated support forum where they can ask for help, offer assistance, and share local resources. This would strengthen our community bonds and improve mutual aid.",
      };

      // Monitor network requests to catch API calls
      const requests: any[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/forums/category-requests")) {
          requests.push({
            url: request.url(),
            method: request.method(),
            postData: request.postData(),
            headers: request.headers(),
          });
        }
      });

      // Monitor responses to catch errors
      const responses: any[] = [];
      page.on("response", (response) => {
        if (response.url().includes("/api/forums/category-requests")) {
          responses.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
          });
        }
      });

      // Fill out the form
      await page.fill('input[name="name"]', testRequest.name);
      await page.fill('textarea[name="description"]', testRequest.description);
      await page.fill(
        'textarea[name="justification"]',
        testRequest.justification
      );

      // Wait for submit button to be enabled
      await expect(page.locator('button[type="submit"]')).toBeEnabled();

      // Submit the form
      const submitPromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/forums/category-requests") &&
          response.request().method() === "POST",
        { timeout: 10000 }
      );

      await page.click('button[type="submit"]');

      // Wait for the API response
      let response;
      try {
        response = await submitPromise;
        console.log("API Response Status:", response.status());
        console.log("API Response URL:", response.url());

        if (response.status() !== 200 && response.status() !== 201) {
          const responseText = await response.text();
          console.log("API Error Response:", responseText);
        }
      } catch (error) {
        console.log("API Request Details:", requests);
        console.log("API Response Details:", responses);
        throw new Error(`Failed to get API response: ${error}`);
      }

      // Verify successful submission (should show success message or redirect)
      await page.waitForTimeout(2000); // Wait for any success message or redirect

      // Check for success indicators
      const successIndicators = [
        page.locator("text=/request.*submitted/i"),
        page.locator("text=/success/i"),
        page.locator('[data-testid="success-message"]'),
        page.locator(".alert-success"),
      ];

      let foundSuccessIndicator = false;
      for (const indicator of successIndicators) {
        try {
          await indicator.waitFor({ timeout: 2000 });
          foundSuccessIndicator = true;
          break;
        } catch {
          // Continue to next indicator
        }
      }

      // Check if we were redirected (another success pattern)
      const currentUrl = page.url();
      const wasRedirected =
        !currentUrl.includes("/request-category") &&
        currentUrl.includes("/forums");

      if (!foundSuccessIndicator && !wasRedirected) {
        // Capture page content for debugging
        console.log("Page URL after submission:", currentUrl);
        console.log("Page title:", await page.title());
        console.log(
          "Visible text on page:",
          await page.locator("body").textContent()
        );
      }

      // Verify the request was saved to database
      const db = getPrisma();
      const savedRequest = await db.forumCategoryRequest.findFirst({
        where: {
          name: testRequest.name,
          requestedBy: user.id,
        },
        include: {
          requester: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      expect(savedRequest).toBeTruthy();
      expect(savedRequest?.name).toBe(testRequest.name);
      expect(savedRequest?.description).toBe(testRequest.description);
      expect(savedRequest?.justification).toBe(testRequest.justification);
      expect(savedRequest?.status).toBe("pending");
      expect(savedRequest?.requestedBy).toBe(user.id);
      expect(savedRequest?.createdDate).toBeTruthy();

      console.log("✅ Category request successfully saved to database:", {
        id: savedRequest?.id,
        name: savedRequest?.name,
        status: savedRequest?.status,
        createdDate: savedRequest?.createdDate,
      });
    });

    test("should handle authentication errors during submission", async ({
      page,
    }) => {
      // Create user but don't login
      const userData = generateTestUser();
      await createTestUser(userData);

      // Navigate to form (will redirect to login)
      await page.goto("/forums/request-category");

      // Login but then navigate directly to form (simulating expired session)
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Clear cookies to simulate expired session
      await page.context().clearCookies();

      // Navigate back to form
      await page.goto("/forums/request-category");

      // Try to submit form (should fail with auth error)
      const testRequest = {
        name: "Test Category",
        description: "Test description",
        justification: "Test justification",
      };

      await page.fill('input[name="name"]', testRequest.name);
      await page.fill('textarea[name="description"]', testRequest.description);
      await page.fill(
        'textarea[name="justification"]',
        testRequest.justification
      );

      // Monitor for error responses
      const errorResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/api/forums/category-requests") &&
          response.status() === 401,
        { timeout: 5000 }
      );

      await page.click('button[type="submit"]');

      try {
        await errorResponse;
        console.log("✅ Correctly received 401 authentication error");
      } catch {
        console.log("⚠️ Did not receive expected 401 error");
      }

      // Should show error message or redirect to login
      const errorIndicators = [
        page.locator("text=/authentication/i"),
        page.locator("text=/login/i"),
        page.locator("text=/error/i"),
        page.locator(".alert-error"),
      ];

      let foundError = false;
      for (const indicator of errorIndicators) {
        try {
          await indicator.waitFor({ timeout: 2000 });
          foundError = true;
          break;
        } catch {
          // Continue checking
        }
      }

      // Also check if redirected to login
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      const redirectedToLogin = currentUrl.includes("/login");

      expect(foundError || redirectedToLogin).toBe(true);
    });

    test("should handle server errors gracefully", async ({ page }) => {
      // Create and login user
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      await page.goto("/forums/request-category");

      // Fill form with data that might cause server error (very long justification)
      await page.fill('input[name="name"]', "Test Category");
      await page.fill('textarea[name="description"]', "Test description");
      await page.fill('textarea[name="justification"]', "Valid justification");

      // Monitor for any error responses
      const responses: any[] = [];
      page.on("response", (response) => {
        if (response.url().includes("/api/forums/category-requests")) {
          responses.push({
            status: response.status(),
            url: response.url(),
          });
        }
      });

      await page.click('button[type="submit"]');

      // Wait for response
      await page.waitForTimeout(3000);

      // Check if any errors occurred
      const hasError = responses.some((r) => r.status >= 400);

      if (hasError) {
        // Should display user-friendly error message
        const errorMessage = page.locator("text=/error/i, .alert-error");
        await expect(errorMessage).toBeVisible();
      }
    });
  });

  test.describe("Admin Category Request Management", () => {
    test("should display pending category requests in admin interface", async ({
      page,
    }) => {
      // Create regular user and submit a category request
      const userData = generateTestUser();
      const user = await createTestUser(userData);

      // Create a category request directly in database
      const db = getPrisma();
      const categoryRequest = await db.forumCategoryRequest.create({
        data: {
          name: "Community Support",
          description: "A place for community support and mutual aid",
          justification:
            "We need a dedicated space for community members to help each other",
          status: "pending",
          requestedBy: user.id,
          createdDate: new Date(),
        },
      });

      // Create and login admin user
      const adminData = generateTestUser();
      await createTestUser({ ...adminData, role: "admin" });
      await loginUser(page, {
        email: adminData.email,
        password: adminData.password,
      });

      // Navigate to admin forums
      await page.goto("/admin/forums");
      await page.waitForLoadState("networkidle");

      // Should see category request in pending list
      await expect(page.locator(`text=${categoryRequest.name}`)).toBeVisible();
      await expect(page.locator("text=pending")).toBeVisible();
      await expect(page.locator('button:has-text("Approve")')).toBeVisible();
      await expect(page.locator('button:has-text("Reject")')).toBeVisible();
    });

    test("should allow admin to approve category requests", async ({
      page,
    }) => {
      // Create regular user and submit a category request
      const userData = generateTestUser();
      const user = await createTestUser(userData);

      const db = getPrisma();
      const categoryRequest = await db.forumCategoryRequest.create({
        data: {
          name: "Local Events",
          description: "Organize and discuss local community events",
          justification: "We need better event coordination",
          status: "pending",
          requestedBy: user.id,
          createdDate: new Date(),
        },
      });

      // Create and login admin user
      const adminData = generateTestUser();
      const admin = await createTestUser({ ...adminData, role: "admin" });
      await loginUser(page, {
        email: adminData.email,
        password: adminData.password,
      });

      // Navigate to admin forums
      await page.goto("/admin/forums");

      // Find and approve the request
      const requestCard = page
        .locator(`text=${categoryRequest.name}`)
        .locator("..");
      await requestCard.locator('button:has-text("Approve")').click();

      // Wait for approval to complete
      await page.waitForTimeout(2000);

      // Verify request status changed to approved in database
      const updatedRequest = await db.forumCategoryRequest.findUnique({
        where: { id: categoryRequest.id },
      });
      expect(updatedRequest?.status).toBe("approved");
      expect(updatedRequest?.reviewedBy).toBe(admin.id);
      expect(updatedRequest?.reviewedDate).toBeTruthy();

      // Verify new category was created
      const newCategory = await db.forumCategory.findFirst({
        where: { name: categoryRequest.name },
      });
      expect(newCategory).toBeTruthy();
      expect(newCategory?.name).toBe(categoryRequest.name);
      expect(newCategory?.description).toBe(categoryRequest.description);
    });

    test("should allow admin to reject category requests", async ({ page }) => {
      // Create regular user and submit a category request
      const userData = generateTestUser();
      const user = await createTestUser(userData);

      const db = getPrisma();
      const categoryRequest = await db.forumCategoryRequest.create({
        data: {
          name: "Inappropriate Category",
          description: "This should be rejected",
          justification: "Not suitable for our community",
          status: "pending",
          requestedBy: user.id,
          createdDate: new Date(),
        },
      });

      // Create and login admin user
      const adminData = generateTestUser();
      const admin = await createTestUser({ ...adminData, role: "admin" });
      await loginUser(page, {
        email: adminData.email,
        password: adminData.password,
      });

      // Navigate to admin forums
      await page.goto("/admin/forums");

      // Find and reject the request
      const requestCard = page
        .locator(`text=${categoryRequest.name}`)
        .locator("..");
      await requestCard.locator('button:has-text("Reject")').click();

      // Add rejection notes
      await page.fill(
        'textarea[name="reviewNotes"]',
        "Not appropriate for our community"
      );
      await page.click('button:has-text("Confirm Rejection")');

      // Wait for rejection to complete
      await page.waitForTimeout(2000);

      // Verify request status changed to rejected in database
      const updatedRequest = await db.forumCategoryRequest.findUnique({
        where: { id: categoryRequest.id },
      });
      expect(updatedRequest?.status).toBe("rejected");
      expect(updatedRequest?.reviewedBy).toBe(admin.id);
      expect(updatedRequest?.reviewedDate).toBeTruthy();
      expect(updatedRequest?.reviewNotes).toContain("Not appropriate");

      // Verify no category was created
      const noCategory = await db.forumCategory.findFirst({
        where: { name: categoryRequest.name },
      });
      expect(noCategory).toBeFalsy();
    });
  });

  test.describe("Debug Tests for Worcester Issue", () => {
    test("should reproduce the exact Worcester submission flow", async ({
      page,
    }) => {
      console.log(
        "🔍 Starting reproduction test for Worcester category request issue"
      );

      // Create user similar to Worcester community members
      const userData = {
        ...generateTestUser(),
        firstName: "Community",
        lastName: "Member",
      };
      const user = await createTestUser(userData);

      console.log("✅ Created test user:", userData.email);

      // Login exactly as users would
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      console.log("✅ User logged in successfully");

      // Navigate to forums first (common user path)
      await page.goto("/forums");
      await page.waitForLoadState("networkidle");

      // Click on "Request Category" link if available
      try {
        await page.click('text="Request Category"');
      } catch {
        // If no link, navigate directly
        await page.goto("/forums/request-category");
      }

      await page.waitForLoadState("networkidle");
      console.log("✅ Navigated to category request form");

      // Fill out form with data similar to real community support requests
      const realWorldRequest = {
        name: "Community Support",
        description:
          "A dedicated space for community members to seek and offer support, share resources, and help each other with local needs.",
        justification:
          "Many residents have expressed interest in having a forum section where they can ask for help with various needs (like rides, tool borrowing, local recommendations) and offer assistance to neighbors. This would strengthen our community bonds and improve local mutual aid networks.",
      };

      console.log("📝 Filling out form with realistic data");

      // Fill form step by step, monitoring for any issues
      await page.fill('input[name="name"]', realWorldRequest.name);
      await page.waitForTimeout(500);

      await page.fill(
        'textarea[name="description"]',
        realWorldRequest.description
      );
      await page.waitForTimeout(500);

      await page.fill(
        'textarea[name="justification"]',
        realWorldRequest.justification
      );
      await page.waitForTimeout(500);

      console.log("✅ Form filled successfully");

      // Verify submit button is enabled
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();

      // Monitor all network activity during submission
      const networkLogs: any[] = [];
      page.on("request", (req) => {
        if (
          req.url().includes("category-request") ||
          req.url().includes("forums")
        ) {
          networkLogs.push({
            type: "REQUEST",
            method: req.method(),
            url: req.url(),
            headers: req.headers(),
            postData: req.postData(),
          });
        }
      });

      page.on("response", (res) => {
        if (
          res.url().includes("category-request") ||
          res.url().includes("forums")
        ) {
          networkLogs.push({
            type: "RESPONSE",
            status: res.status(),
            url: res.url(),
            statusText: res.statusText(),
          });
        }
      });

      // Monitor console for JavaScript errors
      const consoleLogs: any[] = [];
      page.on("console", (msg) => {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
        });
      });

      page.on("pageerror", (err) => {
        consoleLogs.push({
          type: "error",
          text: err.message,
        });
      });

      console.log("🚀 Submitting form...");

      // Submit the form
      await page.click('button[type="submit"]');

      // Wait for network activity to complete
      await page.waitForTimeout(5000);

      console.log("📊 Network Activity:", networkLogs);
      console.log("📊 Console Logs:", consoleLogs);

      // Check what happened
      const currentUrl = page.url();
      const pageTitle = await page.title();
      const pageText = await page.locator("body").textContent();

      console.log("📍 Final URL:", currentUrl);
      console.log("📍 Page Title:", pageTitle);

      // Check database to see if request was saved
      const db = getPrisma();
      const savedRequests = await db.forumCategoryRequest.findMany({
        where: {
          name: realWorldRequest.name,
          requestedBy: user.id,
        },
      });

      console.log("🗃️ Saved requests in database:", savedRequests.length);

      if (savedRequests.length > 0) {
        console.log("✅ SUCCESS: Request was saved to database");
        console.log("📝 Request details:", savedRequests[0]);
      } else {
        console.log("❌ ISSUE: Request was NOT saved to database");
        console.log("🔍 This reproduces the Worcester issue!");

        // Log all the debugging information
        console.log("🐛 Debug Information:");
        console.log("- Network logs:", JSON.stringify(networkLogs, null, 2));
        console.log("- Console logs:", JSON.stringify(consoleLogs, null, 2));
        console.log("- Final URL:", currentUrl);
        console.log(
          "- Page content contains 'success':",
          pageText?.includes("success")
        );
        console.log(
          "- Page content contains 'error':",
          pageText?.includes("error")
        );
      }

      // The test should fail if no request was saved, which would reproduce the issue
      expect(savedRequests.length).toBeGreaterThan(0);
    });

    test("should verify authentication token persistence during form submission", async ({
      page,
    }) => {
      console.log("🔍 Testing authentication token persistence");

      // Create and login user
      const userData = generateTestUser();
      await createTestUser(userData);
      await loginUser(page, {
        email: userData.email,
        password: userData.password,
      });

      // Navigate to form
      await page.goto("/forums/request-category");

      // Check authentication state before submission
      const cookies = await page.context().cookies();
      const authCookie = cookies.find(
        (c) => c.name.includes("access_token") || c.name.includes("auth")
      );
      console.log(
        "🍪 Auth cookie before submission:",
        authCookie ? "present" : "missing"
      );

      // Check localStorage for any auth tokens
      const localStorage = await page.evaluate(() => {
        const keys = Object.keys(window.localStorage);
        const authKeys = keys.filter(
          (k) => k.includes("auth") || k.includes("token")
        );
        return authKeys.map((k) => ({
          key: k,
          value: window.localStorage.getItem(k),
        }));
      });
      console.log("💾 Auth data in localStorage:", localStorage);

      // Fill and submit form
      await page.fill('input[name="name"]', "Auth Test Category");
      await page.fill(
        'textarea[name="description"]',
        "Testing auth persistence"
      );
      await page.fill(
        'textarea[name="justification"]',
        "Ensuring auth tokens work"
      );

      // Monitor authentication header in API calls
      const authHeaders: any[] = [];
      page.on("request", (req) => {
        if (req.url().includes("/api/")) {
          const headers = req.headers();
          authHeaders.push({
            url: req.url(),
            authHeader: headers["authorization"] || "none",
            cookie: headers["cookie"] || "none",
          });
        }
      });

      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      console.log("🔐 Auth headers in API calls:", authHeaders);

      // Verify auth was properly sent
      const categoryRequestCall = authHeaders.find((h) =>
        h.url.includes("category-requests")
      );
      expect(categoryRequestCall).toBeTruthy();
      expect(
        categoryRequestCall?.authHeader !== "none" ||
          categoryRequestCall?.cookie !== "none"
      ).toBe(true);
    });
  });
});
