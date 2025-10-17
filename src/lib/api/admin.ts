import { ApiClient } from "./client";
import {
  Card,
  CardsResponse,
  CardSubmission,
  CardModification,
  SubmissionsResponse,
  ModificationsResponse,
  Tag,
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
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
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
  async getTags(): Promise<Tag[]> {
    return this.request<Tag[]>("/api/admin/tags");
  }

  async createTag(data: { name: string }): Promise<Tag> {
    return this.request<Tag>("/api/admin/tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTag(tagName: string, data: { name: string }): Promise<Tag> {
    return this.request<Tag>(`/api/admin/tags/${encodeURIComponent(tagName)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTag(tagName: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/admin/tags/${encodeURIComponent(tagName)}`,
      {
        method: "DELETE",
      }
    );
  }
}
