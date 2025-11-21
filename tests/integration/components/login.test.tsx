import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  mockFetchResponses,
  createUserInteractions,
  cleanupComponentTest,
} from "../../utils/component-test-helpers";
import LoginPage from "@/app/login/page";

// Mock the AuthContext
const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    loading: false,
    error: null,
    refreshUser: mockRefreshUser,
    isAuthenticated: false,
    isEmailVerified: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("Login Component Integration", () => {
  const mockUser = {
    id: 1,
    email: "test@example.com",
    first_name: "Test",
    last_name: "User",
    role: "user",
    is_admin: false,
    is_active: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshUser.mockClear();
  });

  afterEach(() => {
    cleanupComponentTest();
  });

  it("should render login form", () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/create a new account/i)).toBeInTheDocument();
  });

  it("should handle successful login", async () => {
    mockFetchResponses([
      {
        url: "/api/auth/login",
        response: {
          user: mockUser,
          access_token: "mock-token",
        },
        status: 200,
      },
    ]);

    const { mockRouter } = renderWithProviders(<LoginPage />);
    const userInteractions = createUserInteractions();

    // Fill out login form
    await userInteractions.fillInput(/email/i, "test@example.com");
    await userInteractions.fillInput(/password/i, "password123");

    // Submit form
    await userInteractions.clickButton(/sign in/i);

    // Wait for API call and navigation
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
            password: "password123",
          }),
        })
      );
    });

    // Verify refreshUser was called
    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("should handle login errors", async () => {
    mockFetchResponses([
      {
        url: "/api/auth/login",
        response: {
          error: {
            message: "Invalid credentials",
          },
        },
        status: 401,
      },
    ]);

    renderWithProviders(<LoginPage />);
    const userInteractions = createUserInteractions();

    // Fill out form with invalid credentials
    await userInteractions.fillInput(/email/i, "wrong@example.com");
    await userInteractions.fillInput(/password/i, "wrongpassword");

    // Submit form
    await userInteractions.clickButton(/sign in/i);

    // Wait for error message to appear
    await waitFor(() => {
      expect(
        screen.getByText(/Invalid email or password/i)
      ).toBeInTheDocument();
    });

    // Should not navigate away
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("should validate required fields", async () => {
    renderWithProviders(<LoginPage />);
    const userInteractions = createUserInteractions();

    // Try to submit without filling fields
    await userInteractions.clickButton(/sign in/i);

    // Form should still be present (not submitted due to HTML5 validation)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("should have link to register page", async () => {
    renderWithProviders(<LoginPage />);

    // Verify register link exists with correct href
    const registerLink = screen.getByRole("link", {
      name: /create an account/i,
    });
    expect(registerLink).toHaveAttribute("href", "/register");
  });
});
