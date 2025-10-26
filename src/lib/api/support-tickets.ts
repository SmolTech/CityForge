import { ApiClient } from "./client";
import {
  SupportTicket,
  SupportTicketStats,
  CreateTicketData,
  UpdateTicketData,
  CreateMessageData,
} from "@/types/support";

export class SupportTicketsApi extends ApiClient {
  /**
   * Get all support tickets (filtered by user role)
   */
  async getTickets(params?: {
    status?: string;
    category?: string;
    priority?: string;
    assigned_to_me?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    tickets: SupportTicket[];
    total: number;
    offset: number;
    limit: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    if (params?.category) queryParams.append("category", params.category);
    if (params?.priority) queryParams.append("priority", params.priority);
    if (params?.assigned_to_me)
      queryParams.append("assigned_to_me", params.assigned_to_me.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());

    const query = queryParams.toString();
    return this.request<{
      tickets: SupportTicket[];
      total: number;
      offset: number;
      limit: number;
    }>(`/api/support-tickets${query ? `?${query}` : ""}`);
  }

  /**
   * Get a specific ticket with messages
   */
  async getTicket(ticketId: number): Promise<SupportTicket> {
    return this.request<SupportTicket>(`/api/support-tickets/${ticketId}`);
  }

  /**
   * Create a new support ticket
   */
  async createTicket(data: CreateTicketData): Promise<SupportTicket> {
    return this.request<SupportTicket>("/api/support-tickets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a support ticket
   */
  async updateTicket(
    ticketId: number,
    data: UpdateTicketData
  ): Promise<SupportTicket> {
    return this.request<SupportTicket>(`/api/support-tickets/${ticketId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a support ticket
   */
  async deleteTicket(ticketId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/support-tickets/${ticketId}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Add a message to a ticket
   */
  async addMessage(
    ticketId: number,
    data: CreateMessageData
  ): Promise<{ id: number; content: string; created_date: string }> {
    return this.request<{
      id: number;
      content: string;
      created_date: string;
    }>(`/api/support-tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get ticket statistics
   */
  async getStats(): Promise<SupportTicketStats> {
    return this.request<SupportTicketStats>("/api/support-tickets/stats");
  }
}
