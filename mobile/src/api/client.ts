import { tokenStorage } from "../utils/tokenStorage";
import { logger } from "../utils/logger";
import { cacheManager } from "../utils/cacheManager";
import { networkManager } from "../utils/networkManager";
import {
  fetchWithMobileTimeout,
  MobileTimeoutError,
} from "../utils/fetchTimeout";
import type {
  User,
  Card,
  Tag,
  CardSubmission,
  BusinessSubmissionInput,
  CardReviewsResponse,
  Review,
  ReviewInput,
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

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

interface CardsApiResponse {
  cards: RawCard[];
  total: number;
  offset: number;
  limit: number;
}

interface CardsListOnlyApiResponse {
  cards: RawCard[];
}

type RawCard = Omit<Card, "tags"> & {
  website_url?: string;
  phone_number?: string;
  address_override_url?: string;
  contact_name?: string;
  tags?: string[] | Tag[];
  share_url?: string;
  average_rating?: number | null;
  review_count?: number;
};

function normalizeCard(card: RawCard): Card {
  const fallbackSlug = (card.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    ...card,
    slug: card.slug || fallbackSlug,
    website: card.website ?? card.website_url,
    phone: card.phone ?? card.phone_number,
    tags: (card.tags ?? []).map((tag, index) =>
      typeof tag === "string" ? { id: index, name: tag } : tag
    ),
  };
}

class ApiClient {
  private baseUrl: string = DEFAULT_API_URL;

  /**
   * Set the base URL for API requests (used when switching instances)
   */
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string | null
  ): Promise<T> {
    // Check if this is a cacheable GET request
    const isGetRequest = !options.method || options.method === "GET";
    const cacheKey = endpoint;


    // For GET requests, try cache first if offline
    if (isGetRequest && networkManager.isOffline()) {
      const cachedData = await cacheManager.get<T>(cacheKey);
      if (cachedData) {
        logger.info(`Serving cached data for ${endpoint} (offline)`);
        return cachedData;
      } else {
        throw new Error("No internet connection and no cached data available");
      }
    }

    // Use provided token or fall back to tokenStorage (for backward compatibility)
    const authToken =
      token !== undefined ? token : await tokenStorage.getToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add Authorization header if token exists and not explicitly excluded
    const skipAuth = (options.headers as Record<string, string>)?.[
      "X-Skip-Auth"
    ];
    if (authToken && !skipAuth) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetchWithMobileTimeout(url, {
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
        // Try cache if request failed but data exists
        if (isGetRequest) {
          const cachedData = await cacheManager.get<T>(cacheKey);
          if (cachedData) {
            logger.info(`Serving cached data for ${endpoint} (request failed)`);
            return cachedData;
          }
        }

        const contentType = response.headers.get("content-type") || "";
        let errorMessage = `Request failed (${response.status})`;

        if (contentType.includes("application/json")) {
          const errorData = (await response.json()) as
            | ApiError
            | { detail?: string };
          if ("error" in errorData && errorData.error?.message) {
            errorMessage = errorData.error.message;
          } else if ("detail" in errorData && errorData.detail) {
            errorMessage = errorData.detail;
          }
        } else {
          const errorText = (await response.text()).trim();
          if (errorText && !errorText.startsWith("<!DOCTYPE")) {
            errorMessage = errorText;
          }
        }

        if (response.status === 404 && endpoint.startsWith("/api/auth/")) {
          errorMessage =
            "This CityForge server does not expose token auth endpoints for mobile login.";
        }

        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const responseText = await response.text();
      const responseData = responseText ? JSON.parse(responseText) : null;

      // Cache successful GET responses
      if (isGetRequest && responseData) {
        // Cache for different durations based on endpoint type
        let cacheTime = 5 * 60 * 1000; // 5 minutes default

        if (endpoint.includes("/cards")) {
          cacheTime = 10 * 60 * 1000; // 10 minutes for cards
        } else if (
          endpoint.includes("/tags") ||
          endpoint.includes("/site-config")
        ) {
          cacheTime = 30 * 60 * 1000; // 30 minutes for relatively static data
        } else if (endpoint.includes("/auth/me")) {
          cacheTime = 2 * 60 * 1000; // 2 minutes for user data
        }

        await cacheManager.set(cacheKey, responseData, cacheTime);
      }

      return responseData;
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof MobileTimeoutError) {
        logger.error(
          "Mobile request timeout for",
          endpoint,
          ":",
          error.message
        );

        // Try cache for GET requests on timeout
        if (isGetRequest) {
          const cachedData = await cacheManager.get<T>(cacheKey);
          if (cachedData) {
            logger.info(`Serving cached data for ${endpoint} (timeout)`);
            return cachedData;
          }
        }

        throw new Error(
          "Request timed out. Please check your connection and try again."
        );
      }

      // Try cache for GET requests on any error
      if (isGetRequest) {
        const cachedData = await cacheManager.get<T>(cacheKey);
        if (cachedData) {
          logger.info(`Serving cached data for ${endpoint} (error fallback)`);
          return cachedData;
        }
      }

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
      logger.error("Logout error:", error);
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
    const page = params?.page ?? 1;
    const perPage = params?.per_page ?? 20;
    const offset = (page - 1) * perPage;

    const queryParams = new URLSearchParams();
    if (params?.tag) {
      queryParams.append("tags", params.tag);
    }
    if (params?.search) {
      queryParams.append("search", params.search);
    }
    queryParams.append("limit", perPage.toString());
    queryParams.append("offset", offset.toString());
    queryParams.append("share_urls", "true");
    queryParams.append("ratings", "true");

    const query = queryParams.toString();
    const response = await this.request<CardsApiResponse | CardsListOnlyApiResponse>(
      `/api/cards${query ? `?${query}` : ""}`
    );

    const rawCards = response.cards ?? [];
    const normalizedCards = rawCards.map(normalizeCard);

    const usesLegacyPagination =
      typeof (response as CardsApiResponse).total === "number" &&
      typeof (response as CardsApiResponse).limit === "number";

    const items = normalizedCards;
    const total = usesLegacyPagination
      ? (response as CardsApiResponse).total
      : normalizedCards.length;
    const responseLimit = usesLegacyPagination
      ? (response as CardsApiResponse).limit
      : perPage;

    return {
      items,
      total,
      page,
      per_page: responseLimit,
      pages: Math.max(1, Math.ceil(total / perPage)),
    };
  }

  async getCard(id: number): Promise<Card> {
    const cards = await this.getCards({ page: 1, per_page: 5000 });
    const card = cards.items.find((item) => item.id === id);
    if (!card) {
      throw new Error("Business not found");
    }
    return card;
  }

  async getCardBySlug(id: number, _slug?: string): Promise<Card> {
    return this.getCard(id);
  }

  // Tags APIs
  async getTags(): Promise<Tag[]> {
    const cards = await this.getCards({ page: 1, per_page: 5000 });
    const unique = new Set<string>();
    for (const card of cards.items) {
      for (const tag of card.tags) {
        if (tag.name) {
          unique.add(tag.name);
        }
      }
    }
    return Array.from(unique)
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({ id: index + 1, name }));
  }

  // Submissions APIs
  async submitCard(data: BusinessSubmissionInput): Promise<CardSubmission> {
    return this.request<CardSubmission>("/api/submissions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMySubmissions(): Promise<CardSubmission[]> {
    return this.request<CardSubmission[]>("/api/submissions");
  }

  async suggestEdit(
    cardId: number,
    data: BusinessSubmissionInput
  ): Promise<CardSubmission> {
    return this.request(`/api/cards/${cardId}/suggest-edit`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCardReviews(
    cardId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<CardReviewsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.limit) {
      queryParams.append("limit", params.limit.toString());
    }
    if (params?.offset) {
      queryParams.append("offset", params.offset.toString());
    }

    const query = queryParams.toString();
    return this.request<CardReviewsResponse>(
      `/api/cards/${cardId}/reviews${query ? `?${query}` : ""}`
    );
  }

  async createCardReview(
    cardId: number,
    data: ReviewInput
  ): Promise<Review> {
    return this.request<Review>(`/api/cards/${cardId}/reviews`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Search APIs
  async search(query: string): Promise<SearchResult[]> {
    try {
      return await this.request<SearchResult[]>(
        `/api/search?q=${encodeURIComponent(query)}`
      );
    } catch {
      const needle = query.trim().toLowerCase();
      if (!needle) {
        return [];
      }

      const cards = await this.getCards({ page: 1, per_page: 5000 });
      return cards.items
        .filter((card) => {
          const haystack = `${card.name} ${card.description || ""} ${
            card.address || ""
          }`.toLowerCase();
          return haystack.includes(needle);
        })
        .map((card) => {
          const titleMatch = card.name.toLowerCase().includes(needle);
          const descriptionMatch = (card.description || "")
            .toLowerCase()
            .includes(needle);
          const score = titleMatch ? 1 : descriptionMatch ? 0.8 : 0.6;
          return {
            id: card.id.toString(),
            card_id: card.id,
            title: card.name,
            content: card.description || "",
            url: `${this.baseUrl}/business/${card.id}/${card.slug}`,
            score,
          };
        })
        .sort((a, b) => b.score - a.score);
    }
  }

  // Resources APIs
  async getResourceCategories(): Promise<ResourceCategory[]> {
    return this.request<ResourceCategory[]>("/api/resources/categories");
  }

  async getResourceItems(category?: string): Promise<ResourceItem[]> {
    const endpoint = category
      ? `/api/resources/items?category=${encodeURIComponent(category)}`
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
