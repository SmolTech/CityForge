import { test, expect } from "@playwright/test";
import {
  loginWithSharedUser,
  clearSharedTestUser,
  generateTestUser,
} from "./helpers/auth";
import {
  cleanDatabase,
  disconnectDatabase,
  createTestUser,
} from "./helpers/database";
import {
  goToDashboard,
  getApprovedCount,
  getPendingCount,
  getOpenClassifiedsCount,
  hasEmptySubmissionsState,
  hasEmptyClassifiedsState,
  submissionExists,
  getSubmissionStatus,
  hasReviewNotes,
  getReviewNotes,
  clickSubmitContentAction,
  clickPostRequestAction,
  clickViewAllClassifieds,
  getSubmissionsListCount,
  hasEmailVerificationBanner,
  isLoadingSpinnerVisible,
  waitForDashboardLoad,
  createCardSubmission,
} from "./helpers/dashboard";

/**
 * E2E Tests for User Dashboard
 *
 * Tests the complete user dashboard functionality including:
 * - Statistics display (submissions, classified posts)
 * - Recent submissions list with statuses
 * - Recent classified posts with interactions
 * - Quick action buttons
 * - Empty states
 * - Error handling
 */

test.describe("Dashboard E2E", () => {
  // Clean database before each test for isolation
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  // Clean up after all tests
  test.afterAll(async () => {
    await clearSharedTestUser();
    await disconnectDatabase();
  });

  test.describe("Dashboard Statistics", () => {
    test("should display correct submission statistics", async ({ page }) => {
      const user = await loginWithSharedUser(page);

      // Create test submissions with different statuses
      await createCardSubmission({
        name: "Approved Business",
        description: "This business is approved",
        submittedBy: user.id,
        status: "approved",
      });

      await createCardSubmission({
        name: "Pending Business",
        description: "This business is pending",
        submittedBy: user.id,
        status: "pending",
      });

      await createCardSubmission({
        name: "Another Pending Business",
        description: "This business is also pending",
        submittedBy: user.id,
        status: "pending",
      });

      // Go to dashboard
      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Verify statistics
      expect(await getApprovedCount(page)).toBe(1);
      expect(await getPendingCount(page)).toBe(2);
    });

    test("should display zero statistics for new user", async ({ page }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Verify zero statistics
      expect(await getApprovedCount(page)).toBe(0);
      expect(await getPendingCount(page)).toBe(0);
      expect(await getOpenClassifiedsCount(page)).toBe(0);
    });

    test("should show correct classified post statistics", async ({ page }) => {
      await loginWithSharedUser(page);

      // Go to dashboard first to ensure we can see the stats
      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // For now, just verify the dashboard loads and shows 0 classifieds
      // (Creating classified posts via E2E would require implementing classified helpers)
      expect(await getOpenClassifiedsCount(page)).toBe(0);
    });
  });

  test.describe("Submissions List", () => {
    test("should display recent submissions with correct statuses", async ({
      page,
    }) => {
      const user = await loginWithSharedUser(page);

      // Create submissions with different statuses
      await createCardSubmission({
        name: "Approved Business",
        description: "This business is approved",
        submittedBy: user.id,
        status: "approved",
      });

      await createCardSubmission({
        name: "Pending Business",
        description: "This business is pending",
        submittedBy: user.id,
        status: "pending",
      });

      await createCardSubmission({
        name: "Rejected Business",
        description: "This business is rejected",
        submittedBy: user.id,
        status: "rejected",
        reviewNotes: "Missing required information",
      });

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Verify submissions are displayed
      expect(await submissionExists(page, "Approved Business")).toBe(true);
      expect(await submissionExists(page, "Pending Business")).toBe(true);
      expect(await submissionExists(page, "Rejected Business")).toBe(true);

      // Verify statuses
      expect(await getSubmissionStatus(page, "Approved Business")).toContain(
        "Approved"
      );
      expect(await getSubmissionStatus(page, "Pending Business")).toContain(
        "Pending"
      );
      expect(await getSubmissionStatus(page, "Rejected Business")).toContain(
        "Rejected"
      );

      // Verify review notes for rejected submission
      expect(await hasReviewNotes(page, "Rejected Business")).toBe(true);
      expect(await getReviewNotes(page, "Rejected Business")).toContain(
        "Missing required information"
      );
    });

    test("should show empty state when no submissions", async ({ page }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Should show empty submissions state
      expect(await hasEmptySubmissionsState(page)).toBe(true);
    });

    test("should show correct number of submissions in list", async ({
      page,
    }) => {
      const user = await loginWithSharedUser(page);

      // Create multiple submissions
      for (let i = 1; i <= 3; i++) {
        await createCardSubmission({
          name: `Test Business ${i}`,
          description: `Description for business ${i}`,
          submittedBy: user.id,
          status: "pending",
        });
      }

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Should show 3 submissions in the list
      expect(await getSubmissionsListCount(page)).toBe(3);
    });
  });

  test.describe("Quick Actions", () => {
    test("should navigate to submit page via quick action", async ({
      page,
    }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Click submit content action
      await clickSubmitContentAction(page);

      // Should navigate to submit page
      expect(page.url()).toContain("/submit");
    });

    test("should navigate to classified creation via quick action", async ({
      page,
    }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Click post request action
      await clickPostRequestAction(page);

      // Should navigate to classifieds creation page
      expect(page.url()).toContain("/classifieds/new");
    });
  });

  test.describe("Classified Posts Section", () => {
    test("should show empty state when no classified posts", async ({
      page,
    }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Should show empty classifieds state
      expect(await hasEmptyClassifiedsState(page)).toBe(true);
    });

    test("should navigate to all classifieds page", async ({ page }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Click view all classifieds (this should work even with empty state)
      await clickViewAllClassifieds(page);

      // Should navigate to classifieds page
      expect(page.url()).toContain("/classifieds");
    });
  });

  test.describe("UI States and Error Handling", () => {
    test("should handle loading states gracefully", async ({ page }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);

      // Dashboard should eventually load without permanent loading spinners
      await waitForDashboardLoad(page);

      // Loading spinner should not be visible after load completes
      expect(await isLoadingSpinnerVisible(page)).toBe(false);
    });

    test("should display email verification banner for unverified users", async ({
      page,
    }) => {
      // Create an unverified user
      const userData = generateTestUser();
      await createTestUser({
        ...userData,
        emailVerified: false, // Not verified
      });

      // Login with this specific unverified user (not shared user)
      await page.goto("/login");
      await page.fill('input[name="email"]', userData.email);
      await page.fill('input[name="password"]', userData.password);
      await page.click('button[type="submit"]');

      // Wait for authentication
      await page.waitForURL("/dashboard", { timeout: 10000 });
      await waitForDashboardLoad(page);

      // Should show email verification banner
      expect(await hasEmailVerificationBanner(page)).toBe(true);
    });

    test("should not display email verification banner for verified users", async ({
      page,
    }) => {
      await loginWithSharedUser(page); // Shared user is auto-verified

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Should not show email verification banner
      expect(await hasEmailVerificationBanner(page)).toBe(false);
    });
  });

  test.describe("Responsive Design", () => {
    test("should display correctly on mobile viewport", async ({ page }) => {
      await loginWithSharedUser(page);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Basic checks that page elements are visible on mobile
      await expect(page.locator('text="Your Dashboard"')).toBeVisible();
      await expect(page.locator('text="Statistics"')).toBeVisible();
    });

    test("should display correctly on desktop viewport", async ({ page }) => {
      await loginWithSharedUser(page);

      // Set desktop viewport
      await page.setViewportSize({ width: 1200, height: 800 });

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Basic checks that page elements are visible on desktop
      await expect(page.locator('text="Your Dashboard"')).toBeVisible();
      await expect(page.locator('text="Statistics"')).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper heading structure", async ({ page }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Check for proper heading hierarchy
      await expect(page.locator("h1, h2, h3").first()).toBeVisible();
    });

    test("should have accessible navigation", async ({ page }) => {
      await loginWithSharedUser(page);

      await goToDashboard(page);
      await waitForDashboardLoad(page);

      // Check that buttons and links have proper labels
      const submitButton = page.locator('a:has-text("Submit Content")').first();
      await expect(submitButton).toBeVisible();
    });
  });
});
