import { tokenStorage } from "../utils/tokenStorage";
import type {
  User,
  Card,
  Tag,
  CardSubmission,
  ResourceCategory,
  ResourceItem,
  QuickAccessItem,
  SiteConfig,
  SearchResult,
  PaginatedResponse,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ApiError,
} from "../types/api";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] || "http://localhost:5000";

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await tokenStorage.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add Authorization header if token exists and not explicitly excluded
    const skipAuth = (options.headers as Record<string, string>)?.[
      "X-Skip-Auth"
    ];
    if (token && !skipAuth) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401) {
        await tokenStorage.removeToken();
        throw new Error("Unauthorized - please login again");
      }

      // Handle other error responses
      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error?.message || "An error occurred");
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error - please check your connection");
    }
  }

  // Authentication APIs
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      headers: { "X-Skip-Auth": "true" },
    });

    // Store token in secure storage
    if (response.access_token) {
      await tokenStorage.setToken(response.access_token);
    }

    return response;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "X-Skip-Auth": "true" },
    });

    // Store token in secure storage
    if (response.access_token) {
      await tokenStorage.setToken(response.access_token);
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request("/api/auth/logout", { method: "POST" });
    } catch (error) {
      // Even if logout fails, remove token locally
      console.error("Logout error:", error);
    } finally {
      await tokenStorage.removeToken();
    }
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>("/api/auth/me");
  }

  async updateEmail(email: string): Promise<{ message: string }> {
    return this.request("/api/auth/update-email", {
      method: "PUT",
      body: JSON.stringify({ email }),
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

  // Cards APIs
  async getCards(params?: {
    tag?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Card>> {
    const queryParams = new URLSearchParams();
    if (params?.tag) queryParams.append("tag", params.tag);
    if (params?.search) queryParams.append("search", params.search);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.per_page)
      queryParams.append("per_page", params.per_page.toString());

    const query = queryParams.toString();
    return this.request<PaginatedResponse<Card>>(
      `/api/cards${query ? `?${query}` : ""}`
    );
  }

  async getCard(id: number): Promise<Card> {
    return this.request<Card>(`/api/cards/${id}`);
  }

  async getCardBySlug(slug: string): Promise<Card> {
    return this.request<Card>(`/api/business/${slug}`);
  }

  // Tags APIs
  async getTags(): Promise<Tag[]> {
    return this.request<Tag[]>("/api/tags");
  }

  // Submissions APIs
  async submitCard(data: Partial<Card>): Promise<CardSubmission> {
    return this.request<CardSubmission>("/api/submissions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async suggestEdit(
    cardId: number,
    data: Partial<Card>
  ): Promise<{ message: string }> {
    return this.request(`/api/cards/${cardId}/suggest-edit`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Search APIs
  async search(query: string): Promise<SearchResult[]> {
    return this.request<SearchResult[]>(
      `/api/search?q=${encodeURIComponent(query)}`
    );
  }

  // Resources APIs
  async getResourceCategories(): Promise<ResourceCategory[]> {
    return this.request<ResourceCategory[]>("/api/resources/categories");
  }

  async getResourceItems(categoryId?: number): Promise<ResourceItem[]> {
    const endpoint = categoryId
      ? `/api/resources/items?category_id=${categoryId}`
      : "/api/resources/items";
    return this.request<ResourceItem[]>(endpoint);
  }

  async getQuickAccessItems(): Promise<QuickAccessItem[]> {
    return this.request<QuickAccessItem[]>("/api/resources/quick-access");
  }

  // Site Config APIs
  async getSiteConfig(): Promise<SiteConfig> {
    return this.request<SiteConfig>("/api/site-config");
  }
}

export const apiClient = new ApiClient();
