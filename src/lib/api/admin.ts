import { ApiClient } from "./client";
import {
  Card,
  CardsResponse,
  CardSubmission,
  CardModification,
  SubmissionsResponse,
  ModificationsResponse,
  User,
} from "./types";

export class AdminApi extends ApiClient {
  // Card management
  async getCards(params?: {
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

  async createCard(
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

  async updateCard(
    cardId: number,
    data: Partial<Card & { tags: string[] }>
  ): Promise<Card> {
    return this.request(`/api/admin/cards/${cardId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteCard(cardId: number): Promise<{ message: string }> {
    return this.request(`/api/admin/cards/${cardId}`, {
      method: "DELETE",
    });
  }

  // Submission management
  async getSubmissions(params?: {
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

  async approveSubmission(
    id: number,
    data?: { featured?: boolean; notes?: string }
  ): Promise<{ message: string; card: Card; submission: CardSubmission }> {
    return this.request(`/api/admin/submissions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }

  async rejectSubmission(
    id: number,
    notes?: string
  ): Promise<{ message: string; submission: CardSubmission }> {
    return this.request(`/api/admin/submissions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes: notes || "" }),
    });
  }

  // Modification management
  async getModifications(params?: {
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

  async approveModification(
    id: number
  ): Promise<{ message: string; modification: CardModification; card: Card }> {
    return this.request(`/api/admin/modifications/${id}/approve`, {
      method: "POST",
    });
  }

  async rejectModification(
    id: number,
    notes?: string
  ): Promise<{ message: string; modification: CardModification }> {
    return this.request(`/api/admin/modifications/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes: notes || "" }),
    });
  }

  // User management
  async getUsers(params?: {
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

    // Convert page to offset for backend API
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const offset = (page - 1) * limit;

    searchParams.append("offset", offset.toString());
    searchParams.append("limit", limit.toString());
    if (params?.search) searchParams.append("search", params.search);

    const queryString = searchParams.toString();
    const url = `/api/admin/users${queryString ? "?" + queryString : ""}`;

    return this.request(url);
  }

  async updateUser(userId: number, data: Partial<User>): Promise<User> {
    return this.request(`/api/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId: number): Promise<{ message: string }> {
    return this.request(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
  }

  async resetUserPassword(
    userId: number,
    newPassword: string
  ): Promise<{ message: string }> {
    return this.request(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  // Tag management
  async getTags(): Promise<{
    tags: Array<{
      id: number;
      name: string;
      created_date: string;
      card_count: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    return this.request("/api/admin/tags");
  }

  async getTag(tagId: number): Promise<{
    tag: {
      id: number;
      name: string;
      created_date: string;
      card_count: number;
    };
  }> {
    return this.request(`/api/admin/tags/${tagId}`);
  }

  async createTag(data: { name: string }): Promise<{
    tag: {
      id: number;
      name: string;
      created_date: string;
      card_count: number;
    };
    message: string;
  }> {
    return this.request("/api/admin/tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTag(
    tagId: number,
    data: { name: string }
  ): Promise<{
    tag: {
      id: number;
      name: string;
      created_date: string;
      card_count: number;
    };
    message: string;
  }> {
    return this.request(`/api/admin/tags/${tagId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTag(tagId: number): Promise<{
    message: string;
    cards_affected: number;
  }> {
    return this.request(`/api/admin/tags/${tagId}`, {
      method: "DELETE",
    });
  }

  // Forum management
  async adminGetForumCategories(): Promise<any> {
    return this.request("/api/admin/forums/categories");
  }

  async adminCreateForumCategory(data: {
    name: string;
    description: string;
    display_order?: number;
    is_active?: boolean;
  }): Promise<any> {
    return this.request("/api/admin/forums/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateForumCategory(
    categoryId: number,
    data: { name?: string; description?: string; displayOrder?: number }
  ): Promise<any> {
    return this.request(`/api/admin/forums/categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteForumCategory(categoryId: number): Promise<any> {
    return this.request(`/api/admin/forums/categories/${categoryId}`, {
      method: "DELETE",
    });
  }

  async adminGetForumCategoryRequests(): Promise<any> {
    return this.request("/api/admin/forums/category-requests");
  }

  async adminApproveForumCategoryRequest(requestId: number): Promise<any> {
    return this.request(
      `/api/admin/forums/category-requests/${requestId}/approve`,
      {
        method: "POST",
      }
    );
  }

  async adminRejectForumCategoryRequest(
    requestId: number,
    notes: string
  ): Promise<any> {
    return this.request(
      `/api/admin/forums/category-requests/${requestId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
      }
    );
  }

  async adminGetForumReports(filter?: string): Promise<any> {
    const searchParams = new URLSearchParams();
    if (filter && filter !== "all") {
      searchParams.append("status", filter);
    }
    const query = searchParams.toString();
    return this.request(`/api/admin/forums/reports${query ? `?${query}` : ""}`);
  }

  async adminResolveForumReport(
    reportId: number,
    action: "dismiss" | "delete_post" | "delete_thread",
    notes?: string
  ): Promise<any> {
    return this.request(`/api/admin/forums/reports/${reportId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    });
  }

  async adminDeleteForumThread(threadId: number): Promise<any> {
    return this.request(`/api/admin/forums/threads/${threadId}`, {
      method: "DELETE",
    });
  }

  async adminPinForumThread(threadId: number): Promise<any> {
    return this.request(`/api/admin/forums/threads/${threadId}/pin`, {
      method: "POST",
    });
  }

  async adminLockForumThread(threadId: number): Promise<any> {
    return this.request(`/api/admin/forums/threads/${threadId}/lock`, {
      method: "POST",
    });
  }
}
