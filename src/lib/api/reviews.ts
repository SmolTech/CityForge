import { ApiClient } from "./client";
import { AdminReview, AdminReviewsResponse } from "./types";

export class ReviewsApi extends ApiClient {
  async getReviews(params?: {
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

  async hideReview(reviewId: number): Promise<{
    message: string;
    review: AdminReview;
  }> {
    return this.request(`/api/admin/reviews/${reviewId}/hide`, {
      method: "POST",
    });
  }

  async unhideReview(reviewId: number): Promise<{
    message: string;
    review: AdminReview;
  }> {
    return this.request(`/api/admin/reviews/${reviewId}/unhide`, {
      method: "POST",
    });
  }

  async dismissReviewReport(reviewId: number): Promise<{
    message: string;
    review: AdminReview;
  }> {
    return this.request(`/api/admin/reviews/${reviewId}/dismiss-report`, {
      method: "POST",
    });
  }

  async deleteReview(reviewId: number): Promise<{ message: string }> {
    return this.request(`/api/admin/reviews/${reviewId}`, {
      method: "DELETE",
    });
  }
}
