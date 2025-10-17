import { ApiClient } from "./client";
import { AuthResponse, User } from "./types";

export class AuthApi extends ApiClient {
  async register(userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", response.access_token);
    }

    return response;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", response.access_token);
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue with logout even if request fails
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
    }
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.request<{ user: User }>("/api/auth/me");
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
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
