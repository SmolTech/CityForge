const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "" : "http://localhost:5000");

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_date: string;
  last_login?: string;
}

export interface Card {
  id: number;
  name: string;
  description: string;
  website_url?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  address_override_url?: string;
  contact_name?: string;
  featured: boolean;
  image_url?: string;
  approved: boolean;
  created_date: string;
  updated_date: string;
  tags: string[];
  creator?: User;
  approver?: User;
  approved_date?: string;
  slug?: string;
  share_url?: string;
}

export interface CardSubmission {
  id: number;
  name: string;
  description: string;
  website_url?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  address_override_url?: string;
  contact_name?: string;
  image_url?: string;
  tags_text: string;
  status: "pending" | "approved" | "rejected";
  review_notes?: string;
  created_date: string;
  reviewed_date?: string;
  submitter?: User;
  reviewer?: User;
  card_id?: number;
}

export interface CardModification {
  id: number;
  card_id: number;
  name: string;
  description: string;
  website_url?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  address_override_url?: string;
  contact_name?: string;
  image_url?: string;
  tags_text: string;
  status: "pending" | "approved" | "rejected";
  review_notes?: string;
  created_date: string;
  reviewed_date?: string;
  submitter?: User;
  reviewer?: User;
  card?: Card;
}

export interface Tag {
  name: string;
  count: number;
}

export interface CardsResponse {
  cards: Card[];
  total: number;
  offset: number;
  limit: number;
}

export interface SubmissionsResponse {
  submissions: CardSubmission[];
  total: number;
  offset: number;
  limit: number;
}

export interface ModificationsResponse {
  modifications: CardModification[];
  total: number;
  offset: number;
  limit: number;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface ResourceConfig {
  id: number;
  key: string;
  value: string;
  description?: string;
  created_date: string;
  updated_date: string;
}

export interface QuickAccessItem {
  id: string;
  title: string;
  subtitle: string;
  phone: string;
  color: string;
  icon: string;
}

export interface QuickAccessItemInput {
  identifier: string;
  title: string;
  subtitle: string;
  phone: string;
  color?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface ResourceItem {
  id: number;
  title: string;
  url: string;
  description: string;
  category: string;
  phone?: string;
  address?: string;
  icon: string;
}

export interface ResourceItemInput {
  title: string;
  url: string;
  description: string;
  category: string;
  phone?: string;
  address?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface HelpWantedPost {
  id: number;
  title: string;
  description: string;
  category: "hiring" | "collaboration" | "general";
  status: "open" | "closed";
  location?: string;
  budget?: string;
  contact_preference?: string;
  report_count: number;
  created_date: string;
  updated_date: string;
  creator?: User;
  comment_count: number;
  comments?: HelpWantedComment[];
}

export interface HelpWantedComment {
  id: number;
  post_id: number;
  content: string;
  parent_id?: number;
  created_date: string;
  updated_date: string;
  creator?: User;
  replies?: HelpWantedComment[];
}

export interface HelpWantedReport {
  id: number;
  post_id: number;
  reason: "spam" | "inappropriate" | "misleading" | "other";
  details?: string;
  status: "pending" | "reviewed" | "resolved";
  created_date: string;
  reviewed_date?: string;
  reporter?: User;
  reviewer?: User;
  resolution_notes?: string;
  post?: HelpWantedPost;
}

export interface HelpWantedPostsResponse {
  posts: HelpWantedPost[];
  total: number;
  offset: number;
  limit: number;
}

export interface HelpWantedReportsResponse {
  reports: HelpWantedReport[];
  total: number;
  offset: number;
  limit: number;
}

export interface AdminReview {
  id: number;
  card_id: number;
  rating: number;
  title?: string;
  comment?: string;
  hidden: boolean;
  created_date: string;
  updated_date: string;
  reported: boolean;
  reported_date?: string;
  reported_reason?: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  reporter?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  card?: {
    id: number;
    name: string;
    image_url?: string;
  };
}

export interface AdminReviewsResponse {
  reviews: AdminReview[];
  total: number;
  offset: number;
  limit: number;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("auth_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        if (response.status === 401 && endpoint !== "/api/auth/login") {
          // Token expired or invalid (but not a login failure)
          this.logout();
          window.location.href = "/login";
        }

        // Try to extract error message from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If response is not JSON, use default message
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed for", endpoint, ":", error);
      throw error;
    }
  }

  // Authentication methods
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

  // User profile update methods
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

  async getCards(params?: {
    search?: string;
    tags?: string[];
    tagMode?: "and" | "or";
    type?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    includeShareUrls?: boolean;
  }): Promise<CardsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.append("search", params.search);
    if (params?.tags) {
      params.tags.forEach((tag) => searchParams.append("tags", tag));
    }
    if (params?.tagMode) searchParams.append("tag_mode", params.tagMode);
    if (params?.type) searchParams.append("type", params.type);
    if (params?.featured) searchParams.append("featured", "true");
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());
    if (params?.includeShareUrls) searchParams.append("share_urls", "true");

    const query = searchParams.toString();
    return this.request<CardsResponse>(`/api/cards${query ? `?${query}` : ""}`);
  }

  async getCard(id: number, includeShareUrl?: boolean): Promise<Card> {
    const params = includeShareUrl ? "?share_url=true" : "";
    return this.request<Card>(`/api/cards/${id}${params}`);
  }

  async getBusiness(id: number, slug?: string): Promise<Card> {
    const url = slug ? `/api/business/${id}/${slug}` : `/api/business/${id}`;
    return this.request<Card>(url);
  }

  async getTags(): Promise<Tag[]> {
    return this.request<Tag[]>("/api/tags");
  }

  // User submission methods
  async submitCard(
    submission: Omit<
      CardSubmission,
      | "id"
      | "status"
      | "created_date"
      | "reviewed_date"
      | "submitter"
      | "reviewer"
      | "card_id"
    >
  ): Promise<CardSubmission> {
    return this.request<CardSubmission>("/api/submissions", {
      method: "POST",
      body: JSON.stringify(submission),
    });
  }

  async getUserSubmissions(): Promise<CardSubmission[]> {
    return this.request<CardSubmission[]>("/api/submissions");
  }

  // File upload
  async uploadFile(file: File): Promise<{ filename: string; url: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const token = this.getAuthToken();
    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
  }

  // Admin methods
  async adminGetCards(params?: {
    search?: string;
    status?: "approved" | "pending" | "all";
    limit?: number;
    offset?: number;
  }): Promise<CardsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.append("search", params.search);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request<CardsResponse>(
      `/api/admin/cards${query ? `?${query}` : ""}`
    );
  }

  async adminCreateCard(
    card: Omit<
      Card,
      | "id"
      | "created_date"
      | "updated_date"
      | "approved"
      | "creator"
      | "approver"
      | "approved_date"
    >
  ): Promise<Card> {
    return this.request<Card>("/api/admin/cards", {
      method: "POST",
      body: JSON.stringify(card),
    });
  }

  async adminGetSubmissions(params?: {
    status?: "pending" | "approved" | "rejected" | "all";
    limit?: number;
    offset?: number;
  }): Promise<SubmissionsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.append("status", params.status);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request<SubmissionsResponse>(
      `/api/admin/submissions${query ? `?${query}` : ""}`
    );
  }

  async adminApproveSubmission(
    id: number,
    data?: { featured?: boolean; notes?: string }
  ): Promise<{ message: string; card: Card; submission: CardSubmission }> {
    return this.request(`/api/admin/submissions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }

  async adminRejectSubmission(
    id: number,
    notes?: string
  ): Promise<{ message: string; submission: CardSubmission }> {
    return this.request(`/api/admin/submissions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes: notes || "" }),
    });
  }

  // Card modification methods
  async suggestCardEdit(
    cardId: number,
    data: Partial<Card & { tags_text: string }>
  ): Promise<{ message: string; modification: CardModification }> {
    return this.request(`/api/cards/${cardId}/suggest-edit`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminGetModifications(params?: {
    status?: "pending" | "approved" | "rejected" | "all";
    limit?: number;
    offset?: number;
  }): Promise<ModificationsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.append("status", params.status);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request(`/api/admin/modifications${query ? `?${query}` : ""}`);
  }

  async adminApproveModification(
    id: number
  ): Promise<{ message: string; modification: CardModification; card: Card }> {
    return this.request(`/api/admin/modifications/${id}/approve`, {
      method: "POST",
    });
  }

  async adminRejectModification(
    id: number,
    notes?: string
  ): Promise<{ message: string; modification: CardModification }> {
    return this.request(`/api/admin/modifications/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes: notes || "" }),
    });
  }

  async adminUpdateCard(
    cardId: number,
    data: Partial<Card & { tags: string[] }>
  ): Promise<Card> {
    return this.request(`/api/admin/cards/${cardId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteCard(cardId: number): Promise<{ message: string }> {
    return this.request(`/api/admin/cards/${cardId}`, {
      method: "DELETE",
    });
  }

  // User Management
  async adminGetUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.search) searchParams.append("search", params.search);

    const queryString = searchParams.toString();
    const url = `/api/admin/users${queryString ? "?" + queryString : ""}`;

    return this.request(url);
  }

  async adminUpdateUser(userId: number, data: Partial<User>): Promise<User> {
    return this.request(`/api/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteUser(userId: number): Promise<{ message: string }> {
    return this.request(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
  }

  async adminResetUserPassword(
    userId: number,
    newPassword: string
  ): Promise<{ message: string }> {
    return this.request(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  // Tag management methods
  async adminGetTags(): Promise<Tag[]> {
    return this.request<Tag[]>("/api/admin/tags");
  }

  async adminCreateTag(data: { name: string }): Promise<Tag> {
    return this.request<Tag>("/api/admin/tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateTag(tagName: string, data: { name: string }): Promise<Tag> {
    return this.request<Tag>(`/api/admin/tags/${encodeURIComponent(tagName)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteTag(tagName: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/admin/tags/${encodeURIComponent(tagName)}`,
      {
        method: "DELETE",
      }
    );
  }

  // Resources methods
  async getResourcesConfig(): Promise<{
    site: {
      title: string;
      description: string;
      domain: string;
    };
    title: string;
    description: string;
    footer: {
      title: string;
      description: string;
      contactEmail: string;
      buttonText: string;
    };
  }> {
    return this.request("/api/resources/config");
  }

  async getQuickAccess(): Promise<
    Array<{
      id: string;
      title: string;
      subtitle: string;
      phone: string;
      color: string;
      icon: string;
    }>
  > {
    return this.request("/api/resources/quick-access");
  }

  async getResourceItems(category?: string): Promise<
    Array<{
      id: number;
      title: string;
      url: string;
      description: string;
      category: string;
      phone?: string;
      address?: string;
      icon: string;
    }>
  > {
    const params = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.request(`/api/resources/items${params}`);
  }

  async getResourceCategories(): Promise<string[]> {
    return this.request("/api/resources/categories");
  }

  async getResources(): Promise<{
    site: {
      title: string;
      description: string;
      domain: string;
    };
    title: string;
    description: string;
    quickAccess: Array<{
      id: string;
      title: string;
      subtitle: string;
      phone: string;
      color: string;
      icon: string;
    }>;
    resources: Array<{
      id: number;
      title: string;
      url: string;
      description: string;
      category: string;
      phone?: string;
      address?: string;
      icon: string;
    }>;
    footer: {
      title: string;
      description: string;
      contactEmail: string;
      buttonText: string;
    };
  }> {
    return this.request("/api/resources");
  }

  // Admin Resources Management
  async adminGetResourceConfigs(): Promise<
    Array<{
      id: number;
      key: string;
      value: string;
      description?: string;
      created_date: string;
      updated_date: string;
    }>
  > {
    return this.request("/api/admin/resources/config");
  }

  async adminUpdateResourceConfig(
    id: number,
    data: { value?: string; description?: string }
  ): Promise<{ message: string; config: ResourceConfig }> {
    return this.request(`/api/admin/resources/config/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminCreateResourceConfig(data: {
    key: string;
    value: string;
    description?: string;
  }): Promise<{ message: string; config: ResourceConfig }> {
    return this.request("/api/admin/resources/config", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminGetQuickAccessItems(): Promise<
    Array<{
      id: string;
      title: string;
      subtitle: string;
      phone: string;
      color: string;
      icon: string;
    }>
  > {
    return this.request("/api/admin/resources/quick-access");
  }

  async adminGetQuickAccessItem(id: number): Promise<{
    id: string;
    title: string;
    subtitle: string;
    phone: string;
    color: string;
    icon: string;
  }> {
    return this.request(`/api/admin/resources/quick-access/${id}`);
  }

  async adminCreateQuickAccessItem(
    data: QuickAccessItemInput
  ): Promise<{ message: string; item: QuickAccessItem }> {
    return this.request("/api/admin/resources/quick-access", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateQuickAccessItem(
    id: number,
    data: Partial<QuickAccessItemInput>
  ): Promise<{ message: string; item: QuickAccessItem }> {
    return this.request(`/api/admin/resources/quick-access/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteQuickAccessItem(id: number): Promise<{ message: string }> {
    return this.request(`/api/admin/resources/quick-access/${id}`, {
      method: "DELETE",
    });
  }

  async adminGetResourceItems(): Promise<
    Array<{
      id: number;
      title: string;
      url: string;
      description: string;
      category: string;
      phone?: string;
      address?: string;
      icon: string;
    }>
  > {
    return this.request("/api/admin/resources/items");
  }

  async adminGetResourceItem(id: number): Promise<{
    id: number;
    title: string;
    url: string;
    description: string;
    category: string;
    phone?: string;
    address?: string;
    icon: string;
  }> {
    return this.request(`/api/admin/resources/items/${id}`);
  }

  async adminCreateResourceItem(
    data: ResourceItemInput
  ): Promise<{ message: string; item: ResourceItem }> {
    return this.request("/api/admin/resources/items", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateResourceItem(
    id: number,
    data: Partial<ResourceItemInput>
  ): Promise<{ message: string; item: ResourceItem }> {
    return this.request(`/api/admin/resources/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteResourceItem(id: number): Promise<{ message: string }> {
    return this.request(`/api/admin/resources/items/${id}`, {
      method: "DELETE",
    });
  }

  // Help Wanted methods
  async getHelpWantedPosts(
    category?: string,
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<HelpWantedPostsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (category) params.append("category", category);
    if (status) params.append("status", status);

    return this.request(`/api/help-wanted?${params.toString()}`);
  }

  async getHelpWantedPost(id: number): Promise<HelpWantedPost> {
    return this.request(`/api/help-wanted/${id}`);
  }

  async createHelpWantedPost(data: {
    title: string;
    description: string;
    category: "hiring" | "collaboration" | "general";
    location?: string;
    budget?: string;
    contact_preference?: string;
  }): Promise<HelpWantedPost> {
    return this.request("/api/help-wanted", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateHelpWantedPost(
    id: number,
    data: Partial<{
      title: string;
      description: string;
      category: "hiring" | "collaboration" | "general";
      status: "open" | "closed";
      location: string;
      budget: string;
      contact_preference: string;
    }>
  ): Promise<HelpWantedPost> {
    return this.request(`/api/help-wanted/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteHelpWantedPost(id: number): Promise<{ message: string }> {
    return this.request(`/api/help-wanted/${id}`, {
      method: "DELETE",
    });
  }

  async createHelpWantedComment(
    postId: number,
    content: string,
    parentId?: number
  ): Promise<HelpWantedComment> {
    return this.request(`/api/help-wanted/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, parent_id: parentId }),
    });
  }

  async updateHelpWantedComment(
    postId: number,
    commentId: number,
    content: string
  ): Promise<HelpWantedComment> {
    return this.request(`/api/help-wanted/${postId}/comments/${commentId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async deleteHelpWantedComment(
    postId: number,
    commentId: number
  ): Promise<{ message: string }> {
    return this.request(`/api/help-wanted/${postId}/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  async reportHelpWantedPost(
    postId: number,
    reason: "spam" | "inappropriate" | "misleading" | "other",
    details?: string
  ): Promise<HelpWantedReport> {
    return this.request(`/api/help-wanted/${postId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason, details }),
    });
  }

  async getMyHelpWantedPosts(): Promise<HelpWantedPost[]> {
    return this.request("/api/help-wanted/my-posts");
  }

  // Admin Help Wanted methods
  async adminGetHelpWantedReports(
    status = "pending",
    limit = 50,
    offset = 0
  ): Promise<HelpWantedReportsResponse> {
    const params = new URLSearchParams({
      status,
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return this.request(`/api/admin/help-wanted/reports?${params.toString()}`);
  }

  async adminResolveHelpWantedReport(
    reportId: number,
    action: "dismiss" | "delete_post",
    notes?: string
  ): Promise<{ message: string; report: HelpWantedReport }> {
    return this.request(`/api/admin/help-wanted/reports/${reportId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    });
  }

  async adminGetHelpWantedPosts(
    status?: string,
    category?: string,
    limit = 50,
    offset = 0
  ): Promise<HelpWantedPostsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (status) params.append("status", status);
    if (category) params.append("category", category);

    return this.request(`/api/admin/help-wanted/posts?${params.toString()}`);
  }

  async adminDeleteHelpWantedPost(
    postId: number
  ): Promise<{ message: string }> {
    return this.request(`/api/admin/help-wanted/posts/${postId}`, {
      method: "DELETE",
    });
  }

  // Admin Review methods
  async adminGetReviews(params?: {
    status?: "all" | "reported" | "hidden";
    card_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<AdminReviewsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.append("status", params.status);
    if (params?.card_id)
      searchParams.append("card_id", params.card_id.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request<AdminReviewsResponse>(
      `/api/admin/reviews${query ? `?${query}` : ""}`
    );
  }

  async adminHideReview(reviewId: number): Promise<{
    message: string;
    review: AdminReview;
  }> {
    return this.request(`/api/admin/reviews/${reviewId}/hide`, {
      method: "POST",
    });
  }

  async adminUnhideReview(reviewId: number): Promise<{
    message: string;
    review: AdminReview;
  }> {
    return this.request(`/api/admin/reviews/${reviewId}/unhide`, {
      method: "POST",
    });
  }

  async adminDismissReviewReport(reviewId: number): Promise<{
    message: string;
    review: AdminReview;
  }> {
    return this.request(`/api/admin/reviews/${reviewId}/dismiss-report`, {
      method: "POST",
    });
  }

  async adminDeleteReview(reviewId: number): Promise<{ message: string }> {
    return this.request(`/api/admin/reviews/${reviewId}`, {
      method: "DELETE",
    });
  }
}

export const apiClient = new ApiClient();
