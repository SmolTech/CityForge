import { ApiClient } from "./client";
import { AuthResponse, User } from "./types";

export class AuthApi extends ApiClient {
  async register(userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue with logout even if request fails
    }
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.request<{ user: User }>("/api/auth/me", {
      skipAuthRedirect: true, // Don't redirect on 401 - let caller handle it
    });
  }

  isAuthenticated(): boolean {
    // With httpOnly cookies, we can't check auth state from localStorage
    // Components should use getCurrentUser() to verify authentication
    // This method is kept for backward compatibility but always returns true
    // The actual auth check happens when making API requests
    return true;
  }

  async updateEmail(
    email: string,
    currentPassword: string
  ): Promise<{ message: string; user: User }> {
    return this.request("/api/auth/update-email", {
      method: "PUT",
      body: JSON.stringify({ email, current_password: currentPassword }),
    });
  }

  async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return this.request("/api/auth/update-password", {
      method: "PUT",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  async updateProfile(
    firstName: string,
    lastName: string
  ): Promise<{ message: string; user: User }> {
    return this.request("/api/auth/update-profile", {
      method: "PUT",
      body: JSON.stringify({ first_name: firstName, last_name: lastName }),
    });
  }
}
