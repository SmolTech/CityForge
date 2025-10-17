import { ApiClient } from "./client";
import {
  HelpWantedPost,
  HelpWantedComment,
  HelpWantedReport,
  HelpWantedPostsResponse,
  HelpWantedReportsResponse,
} from "./types";

export class HelpWantedApi extends ApiClient {
  // Public help wanted methods
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

  // Admin help wanted methods
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
}
