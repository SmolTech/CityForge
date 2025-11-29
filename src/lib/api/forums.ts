import { ApiClient } from "./client";
import {
  ForumCategory,
  ForumCategoryRequest,
  ForumThread,
  ForumPost,
  ForumReport,
  ForumThreadsResponse,
  ForumReportsResponse,
  ForumCategoryRequestsResponse,
} from "./types";

export class ForumsApi extends ApiClient {
  // Public forum methods
  async getForumCategories(includeStats = false): Promise<ForumCategory[]> {
    const params = includeStats ? "?include_stats=true" : "";
    const response: { categories?: ForumCategory[] } | ForumCategory[] =
      await this.request(`/api/forums/categories${params}`);
    return Array.isArray(response) ? response : response.categories || [];
  }

  async getForumCategory(slug: string): Promise<ForumCategory> {
    return this.request(`/api/forums/categories/${slug}`);
  }

  async getCategoryThreads(
    categorySlug: string,
    limit = 50,
    offset = 0
  ): Promise<ForumThreadsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return this.request(
      `/api/forums/categories/${categorySlug}/threads?${params.toString()}`
    );
  }

  async getForumThread(
    threadId: number,
    categorySlug: string
  ): Promise<ForumThread> {
    return this.request(
      `/api/forums/categories/${categorySlug}/threads/${threadId}`
    );
  }

  async createForumThread(
    categorySlug: string,
    data: { title: string; content: string }
  ): Promise<ForumThread> {
    return this.request(`/api/forums/categories/${categorySlug}/threads`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateForumThread(
    threadId: number,
    data: { title?: string }
  ): Promise<ForumThread> {
    return this.request(`/api/forums/threads/${threadId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteForumThread(threadId: number): Promise<{ message: string }> {
    return this.request(`/api/forums/threads/${threadId}`, {
      method: "DELETE",
    });
  }

  async createForumPost(threadId: number, content: string): Promise<ForumPost> {
    return this.request(`/api/forums/threads/${threadId}/posts`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  async updateForumPost(postId: number, content: string): Promise<ForumPost> {
    return this.request(`/api/forums/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async deleteForumPost(postId: number): Promise<{ message: string }> {
    return this.request(`/api/forums/posts/${postId}`, {
      method: "DELETE",
    });
  }

  async reportForumThread(
    threadId: number,
    reason: "spam" | "inappropriate" | "harassment" | "off_topic" | "other",
    details?: string
  ): Promise<ForumReport> {
    return this.request(`/api/forums/threads/${threadId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason, details }),
    });
  }

  async reportForumPost(
    postId: number,
    reason: "spam" | "inappropriate" | "harassment" | "off_topic" | "other",
    details?: string
  ): Promise<ForumReport> {
    return this.request(`/api/forums/posts/${postId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason, details }),
    });
  }

  async requestForumCategory(data: {
    name: string;
    description: string;
    justification: string;
  }): Promise<ForumCategoryRequest> {
    return this.request("/api/forums/category-requests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMyForumCategoryRequests(): Promise<ForumCategoryRequest[]> {
    return this.request("/api/forums/category-requests/my-requests");
  }

  async getMyForumThreads(): Promise<ForumThread[]> {
    return this.request("/api/forums/my-threads");
  }

  async getMyForumPosts(): Promise<ForumPost[]> {
    return this.request("/api/forums/my-posts");
  }

  // Admin forum methods
  async adminGetForumCategories(): Promise<ForumCategory[]> {
    const response: { categories?: ForumCategory[] } | ForumCategory[] =
      await this.request("/api/admin/forums/categories");
    return Array.isArray(response) ? response : response.categories || [];
  }

  async adminCreateForumCategory(data: {
    name: string;
    description: string;
    display_order?: number;
    is_active?: boolean;
  }): Promise<ForumCategory> {
    return this.request("/api/admin/forums/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateForumCategory(
    categoryId: number,
    data: Partial<{
      name: string;
      description: string;
      display_order: number;
      is_active: boolean;
    }>
  ): Promise<ForumCategory> {
    return this.request(`/api/admin/forums/categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteForumCategory(
    categoryId: number
  ): Promise<{ message: string }> {
    return this.request(`/api/admin/forums/categories/${categoryId}`, {
      method: "DELETE",
    });
  }

  async adminGetForumCategoryRequests(
    status = "pending",
    limit = 50,
    offset = 0
  ): Promise<ForumCategoryRequestsResponse> {
    const params = new URLSearchParams({
      status,
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return this.request(
      `/api/admin/forums/category-requests?${params.toString()}`
    );
  }

  async adminApproveForumCategoryRequest(requestId: number): Promise<{
    message: string;
    category: ForumCategory;
    request: ForumCategoryRequest;
  }> {
    return this.request(
      `/api/admin/forums/category-requests/${requestId}/approve`,
      {
        method: "POST",
      }
    );
  }

  async adminRejectForumCategoryRequest(
    requestId: number,
    notes?: string
  ): Promise<{ message: string; request: ForumCategoryRequest }> {
    return this.request(
      `/api/admin/forums/category-requests/${requestId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
      }
    );
  }

  async adminGetForumThreads(
    categoryId?: number,
    limit = 50,
    offset = 0
  ): Promise<ForumThreadsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (categoryId) params.append("category_id", categoryId.toString());

    return this.request(`/api/admin/forums/threads?${params.toString()}`);
  }

  async adminPinForumThread(
    threadId: number,
    isPinned?: boolean
  ): Promise<{ message: string; thread: ForumThread }> {
    return this.request(`/api/admin/forums/threads/${threadId}/pin`, {
      method: "POST",
      body: JSON.stringify({ is_pinned: isPinned }),
    });
  }

  async adminLockForumThread(
    threadId: number,
    isLocked?: boolean
  ): Promise<{ message: string; thread: ForumThread }> {
    return this.request(`/api/admin/forums/threads/${threadId}/lock`, {
      method: "POST",
      body: JSON.stringify({ is_locked: isLocked }),
    });
  }

  async adminDeleteForumThread(threadId: number): Promise<{ message: string }> {
    return this.request(`/api/admin/forums/threads/${threadId}`, {
      method: "DELETE",
    });
  }

  async adminGetForumReports(
    status = "pending",
    limit = 50,
    offset = 0
  ): Promise<ForumReportsResponse> {
    const params = new URLSearchParams({
      status,
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return this.request(`/api/admin/forums/reports?${params.toString()}`);
  }

  async adminResolveForumReport(
    reportId: number,
    action: "dismiss" | "delete_post" | "delete_thread",
    notes?: string
  ): Promise<{ message: string; report: ForumReport }> {
    return this.request(`/api/admin/forums/reports/${reportId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    });
  }
}
