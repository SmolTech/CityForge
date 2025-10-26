export interface SupportTicket {
  id: number;
  title: string;
  description: string;
  category:
    | "housing"
    | "food"
    | "transportation"
    | "healthcare"
    | "financial"
    | "other";
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  is_anonymous: boolean;
  created_date: string;
  updated_date: string;
  resolved_date?: string;
  closed_date?: string;
  creator: {
    id?: number;
    username: string;
    email?: string;
  };
  assigned_supporter?: {
    id: number;
    username: string;
    email: string;
  } | null;
  message_count: number;
  messages?: SupportTicketMessage[];
}

export interface SupportTicketMessage {
  id: number;
  ticket_id: number;
  content: string;
  is_internal_note: boolean;
  created_date: string;
  updated_date: string;
  creator: {
    id?: number;
    username: string;
    email?: string;
  };
}

export interface SupportTicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  assigned_to_me?: number;
  unassigned?: number;
}

export interface CreateTicketData {
  title: string;
  description: string;
  category: string;
  priority?: string;
  is_anonymous?: boolean;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  assigned_to?: number | null;
}

export interface CreateMessageData {
  content: string;
  is_internal_note?: boolean;
}
