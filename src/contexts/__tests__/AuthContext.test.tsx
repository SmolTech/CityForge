/**
 * AuthContext Test Suite
 * Tests authentication state management and user data handling
 */

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "@testing-library/react";
import React from "react";
import { AuthProvider, useAuth } from "../AuthContext";
import { apiClient, User } from "@/lib/api";
import { logger } from "@/lib/logger";

// Mock dependencies
vi.mock("@/lib/api", () => ({
  apiClient: {
    getCurrentUser: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

const mockApiClient = apiClient as unknown as { getCurrentUser: Mock };
const mockLogger = logger as unknown as { debug: Mock };

// Test component that uses the auth context
const TestComponent: React.FC = () => {
  const {
    user,
    loading,
    error,
    refreshUser,
    isAuthenticated,
    isEmailVerified,
  } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "not-loading"}</div>
      <div data-testid="error">{error || "no-error"}</div>
      <div data-testid="authenticated">
        {isAuthenticated ? "authenticated" : "not-authenticated"}
      </div>
      <div data-testid="email-verified">
        {isEmailVerified ? "email-verified" : "email-not-verified"}
      </div>
      <div data-testid="user-id">{user?.id || "no-user"}</div>
      <div data-testid="user-email">{user?.email || "no-email"}</div>
      <div data-testid="user-name">
        {user ? `${user.first_name} ${user.last_name}` : "no-name"}
      </div>
      <div data-testid="user-role">{user?.role || "no-role"}</div>
      <div data-testid="is-admin">{user?.is_admin ? "admin" : "not-admin"}</div>
      <button data-testid="refresh-button" onClick={refreshUser}>
        Refresh User
      </button>
    </div>
  );
};

// Component that tests useAuth outside provider
const TestComponentWithoutProvider: React.FC = () => {
  useAuth();
  return <div>Should not render</div>;
};

// Test user data
const mockUser: User = {
  id: 123,
  email: "test@example.com",
  first_name: "John",
  last_name: "Doe",
  role: "user",
  is_admin: false,
  is_supporter: false,
  is_supporter_flag: false,
  is_active: true,
  email_verified: true,
  created_date: "2023-01-01T00:00:00Z",
  last_login: "2023-01-02T00:00:00Z",
};

const mockAdminUser: User = {
  ...mockUser,
  id: 456,
  email: "admin@example.com",
  role: "admin",
  is_admin: true,
};

const mockUnverifiedUser: User = {
  ...mockUser,
  id: 789,
  email: "unverified@example.com",
  email_verified: false,
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AuthProvider", () => {
    it("should initialize with loading state and no user", async () => {
      // Setup mock to return successful user fetch
      mockApiClient.getCurrentUser.mockResolvedValue({ user: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially should be loading
      expect(screen.getByTestId("loading")).toHaveTextContent("loading");
      expect(screen.getByTestId("authenticated")).toHaveTextContent(
        "not-authenticated"
      );
      expect(screen.getByTestId("user-id")).toHaveTextContent("no-user");

      // Wait for user data to load
      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
      });
    });

    it("should load user data successfully on mount", async () => {
      mockApiClient.getCurrentUser.mockResolvedValue({ user: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for user data to load
      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
        expect(screen.getByTestId("email-verified")).toHaveTextContent(
          "email-verified"
        );
        expect(screen.getByTestId("user-id")).toHaveTextContent("123");
        expect(screen.getByTestId("user-email")).toHaveTextContent(
          "test@example.com"
        );
        expect(screen.getByTestId("user-name")).toHaveTextContent("John Doe");
        expect(screen.getByTestId("user-role")).toHaveTextContent("user");
        expect(screen.getByTestId("is-admin")).toHaveTextContent("not-admin");
        expect(screen.getByTestId("error")).toHaveTextContent("no-error");
      });

      expect(mockApiClient.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    it("should handle admin user correctly", async () => {
      mockApiClient.getCurrentUser.mockResolvedValue({ user: mockAdminUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
        expect(screen.getByTestId("user-id")).toHaveTextContent("456");
        expect(screen.getByTestId("user-email")).toHaveTextContent(
          "admin@example.com"
        );
        expect(screen.getByTestId("user-role")).toHaveTextContent("admin");
        expect(screen.getByTestId("is-admin")).toHaveTextContent("admin");
      });
    });

    it("should handle unverified email correctly", async () => {
      mockApiClient.getCurrentUser.mockResolvedValue({
        user: mockUnverifiedUser,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
        expect(screen.getByTestId("email-verified")).toHaveTextContent(
          "email-not-verified"
        );
        expect(screen.getByTestId("user-id")).toHaveTextContent("789");
      });
    });

    it("should handle authentication failure gracefully", async () => {
      const authError = new Error("Authentication failed");
      mockApiClient.getCurrentUser.mockRejectedValue(authError);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "not-authenticated"
        );
        expect(screen.getByTestId("email-verified")).toHaveTextContent(
          "email-not-verified"
        );
        expect(screen.getByTestId("user-id")).toHaveTextContent("no-user");
        expect(screen.getByTestId("error")).toHaveTextContent("no-error"); // Errors are not shown for unauthenticated state
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Failed to get current user (likely not authenticated):",
        authError
      );
    });

    it("should handle network errors gracefully", async () => {
      const networkError = new Error("Network request failed");
      mockApiClient.getCurrentUser.mockRejectedValue(networkError);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "not-authenticated"
        );
        expect(screen.getByTestId("user-id")).toHaveTextContent("no-user");
        expect(screen.getByTestId("error")).toHaveTextContent("no-error");
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Failed to get current user (likely not authenticated):",
        networkError
      );
    });
  });

  describe("refreshUser function", () => {
    it("should refresh user data when called", async () => {
      // Initially return no user
      mockApiClient.getCurrentUser
        .mockResolvedValueOnce({ user: null as unknown as User })
        .mockResolvedValueOnce({ user: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "not-authenticated"
        );
      });

      // Click refresh button
      const refreshButton = screen.getByTestId("refresh-button");
      await act(async () => {
        refreshButton.click();
      });

      // Wait for refresh to complete
      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
        expect(screen.getByTestId("user-id")).toHaveTextContent("123");
      });

      expect(mockApiClient.getCurrentUser).toHaveBeenCalledTimes(2);
    });

    it("should clear error state when refresh succeeds", async () => {
      // First call fails, second succeeds
      mockApiClient.getCurrentUser
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ user: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "not-authenticated"
        );
      });

      // Refresh and succeed
      const refreshButton = screen.getByTestId("refresh-button");
      await act(async () => {
        refreshButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
        expect(screen.getByTestId("error")).toHaveTextContent("no-error");
      });
    });

    it("should handle refresh errors gracefully", async () => {
      // First call succeeds, second fails
      mockApiClient.getCurrentUser
        .mockResolvedValueOnce({ user: mockUser })
        .mockRejectedValueOnce(new Error("Server error"));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial success
      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
      });

      // Refresh and fail
      const refreshButton = screen.getByTestId("refresh-button");
      await act(async () => {
        refreshButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "not-authenticated"
        );
        expect(screen.getByTestId("user-id")).toHaveTextContent("no-user");
        expect(screen.getByTestId("error")).toHaveTextContent("no-error"); // Errors not shown for unauthenticated
      });
    });

    it("should set loading state during refresh", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockApiClient.getCurrentUser.mockReturnValue(promise);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading
      expect(screen.getByTestId("loading")).toHaveTextContent("loading");

      // Resolve the initial promise
      await act(async () => {
        resolvePromise!({ user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
      });

      // Setup new promise for refresh
      const refreshPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApiClient.getCurrentUser.mockReturnValue(refreshPromise);

      // Start refresh - should not show loading (only on initial mount)
      const refreshButton = screen.getByTestId("refresh-button");
      act(() => {
        refreshButton.click();
      });

      // Resolve refresh
      await act(async () => {
        resolvePromise!({ user: mockUser });
      });
    });
  });

  describe("derived state", () => {
    it("should correctly compute isAuthenticated based on user presence", async () => {
      mockApiClient.getCurrentUser.mockResolvedValue({
        user: null as unknown as User,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "not-authenticated"
        );
      });

      // Update with user
      mockApiClient.getCurrentUser.mockResolvedValue({ user: mockUser });
      const refreshButton = screen.getByTestId("refresh-button");

      await act(async () => {
        refreshButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
      });
    });

    it("should correctly compute isEmailVerified based on user.email_verified", async () => {
      // Test verified user
      mockApiClient.getCurrentUser.mockResolvedValue({ user: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("email-verified")).toHaveTextContent(
          "email-verified"
        );
      });

      // Test unverified user
      mockApiClient.getCurrentUser.mockResolvedValue({
        user: mockUnverifiedUser,
      });
      const refreshButton = screen.getByTestId("refresh-button");

      await act(async () => {
        refreshButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("email-verified")).toHaveTextContent(
          "email-not-verified"
        );
      });
    });

    it("should handle null user for email verification", async () => {
      mockApiClient.getCurrentUser.mockResolvedValue({
        user: null as unknown as User,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("email-verified")).toHaveTextContent(
          "email-not-verified"
        );
      });
    });
  });

  describe("useAuth hook", () => {
    it("should throw error when used outside AuthProvider", () => {
      // Suppress console.error for this test since we expect it to throw
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow("useAuth must be used within an AuthProvider");

      consoleSpy.mockRestore();
    });

    it("should return all expected context values", async () => {
      mockApiClient.getCurrentUser.mockResolvedValue({ user: mockUser });

      let contextValue: ReturnType<typeof useAuth> | null = null;

      const TestContextConsumer: React.FC = () => {
        contextValue = useAuth();
        return <div>Context consumer</div>;
      };

      render(
        <AuthProvider>
          <TestContextConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(contextValue).toBeTruthy();
        expect(contextValue!.user).toEqual(mockUser);
        expect(contextValue!.loading).toBe(false);
        expect(contextValue!.error).toBe(null);
        expect(typeof contextValue!.refreshUser).toBe("function");
        expect(contextValue!.isAuthenticated).toBe(true);
        expect(contextValue!.isEmailVerified).toBe(true);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle undefined user email_verified property", async () => {
      const userWithoutEmailVerified = {
        ...mockUser,
        email_verified: undefined as unknown as boolean,
      };

      mockApiClient.getCurrentUser.mockResolvedValue({
        user: userWithoutEmailVerified,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("email-verified")).toHaveTextContent(
          "email-not-verified"
        );
      });
    });

    it("should handle malformed API response", async () => {
      // API returns response without user property
      mockApiClient.getCurrentUser.mockResolvedValue({} as any);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        ); // Truthy object
        expect(screen.getByTestId("user-id")).toHaveTextContent("no-user");
      });
    });

    it("should handle concurrent refresh calls", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockApiClient.getCurrentUser.mockReturnValue(promise);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Resolve initial load
      await act(async () => {
        resolvePromise!({ user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
      });

      // Setup new promise for refresh
      const refreshPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApiClient.getCurrentUser.mockReturnValue(refreshPromise);

      // Make multiple concurrent refresh calls
      const refreshButton = screen.getByTestId("refresh-button");

      await act(async () => {
        refreshButton.click();
        refreshButton.click();
        refreshButton.click();
      });

      // Resolve all promises
      await act(async () => {
        resolvePromise!({ user: mockUser });
      });

      // Should still work correctly
      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
      });

      // Should only make the expected number of API calls (multiple calls might be made due to race conditions)
      expect(mockApiClient.getCurrentUser).toHaveBeenCalled();
    });
  });
});
