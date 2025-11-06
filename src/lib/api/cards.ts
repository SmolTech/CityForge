import { ApiClient } from "./client";
import {
  Card,
  CardsResponse,
  CardSubmission,
  CardModification,
  Tag,
} from "./types";

export class CardsApi extends ApiClient {
  async getCards(params?: {
    search?: string;
    tags?: string[];
    tagMode?: "and" | "or";
    type?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    includeShareUrls?: boolean;
    includeRatings?: boolean;
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
    if (params?.includeRatings) searchParams.append("ratings", "true");

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

  async suggestCardEdit(
    cardId: number,
    data: Partial<Card & { tags_text: string }>
  ): Promise<{ message: string; modification: CardModification }> {
    return this.request(`/api/cards/${cardId}/suggest-edit`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async uploadFile(file: File): Promise<{ filename: string; url: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: "POST",
      credentials: "include", // Include cookies for authentication
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Upload failed (${response.status})`;

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.msg) {
          errorMessage = errorData.msg;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If response is not JSON, use status text
        errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();

    // Handle new response format with backward compatibility
    if (result.success && result.url) {
      return {
        filename: result.filename || file.name,
        url: result.url,
      };
    }

    // Fallback for old response format
    return result;
  }
}
