/**
 * Webhook event types and data structures
 */

export type WebhookEventType =
  | "submission.created"
  | "modification.created"
  | "forum.report.created"
  | "forum.category_request.created"
  | "auth.email_verification.requested"
  | "auth.password_reset.requested"
  | "admin.notification";

export interface BaseWebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  environment: string;
  source: {
    name: string;
    version: string;
  };
}

export interface SubmissionCreatedEvent extends BaseWebhookEvent {
  type: "submission.created";
  data: {
    submission: {
      id: number;
      name: string;
      description?: string;
      website_url?: string;
      phone_number?: string;
      email?: string;
      address?: string;
      contact_name?: string;
      tags_text?: string;
      created_date: string;
    };
    submitter: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    };
    admin_url: string;
  };
}

export interface ModificationCreatedEvent extends BaseWebhookEvent {
  type: "modification.created";
  data: {
    modification: {
      id: number;
      name: string;
      description?: string;
      website_url?: string;
      phone_number?: string;
      email?: string;
      address?: string;
      contact_name?: string;
      tags_text?: string;
      created_date: string;
    };
    submitter: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    };
    card: {
      id: number;
      name: string;
    };
    admin_url: string;
  };
}

export interface ForumReportCreatedEvent extends BaseWebhookEvent {
  type: "forum.report.created";
  data: {
    report: {
      id: number;
      reason: string;
      details?: string;
      created_date: string;
    };
    thread: {
      id: number;
      title: string;
      slug: string;
      categoryId: number;
      category: {
        name: string;
        slug: string;
      };
    };
    post?: {
      id: number;
      content: string;
    };
    reporter: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    };
    admin_url: string;
  };
}

export interface ForumCategoryRequestCreatedEvent extends BaseWebhookEvent {
  type: "forum.category_request.created";
  data: {
    request: {
      id: number;
      name: string;
      description: string;
      justification: string;
      status: string;
      created_date: string;
    };
    requester: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    };
    admin_url: string;
  };
}

export interface EmailVerificationRequestedEvent extends BaseWebhookEvent {
  type: "auth.email_verification.requested";
  data: {
    user: {
      email: string;
      firstName?: string;
      lastName?: string;
    };
    verification_url: string;
    token: string;
  };
}

export interface PasswordResetRequestedEvent extends BaseWebhookEvent {
  type: "auth.password_reset.requested";
  data: {
    user: {
      email: string;
      firstName?: string;
      lastName?: string;
    };
    reset_url: string;
    token: string;
    expires_at: string;
  };
}

export interface AdminNotificationEvent extends BaseWebhookEvent {
  type: "admin.notification";
  data: {
    notification_type:
      | "submission"
      | "modification"
      | "forum_report"
      | "category_request";
    recipients: string[];
    subject: string;
    content: {
      html: string;
      text: string;
    };
    related_data: any;
  };
}

export type WebhookEvent =
  | SubmissionCreatedEvent
  | ModificationCreatedEvent
  | ForumReportCreatedEvent
  | ForumCategoryRequestCreatedEvent
  | EmailVerificationRequestedEvent
  | PasswordResetRequestedEvent
  | AdminNotificationEvent;

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  enabled: boolean;
  events: WebhookEventType[];
  headers?: Record<string, string>;
  retryPolicy?: {
    maxRetries: number;
    retryDelaySeconds: number;
    exponentialBackoff: boolean;
  };
  timeoutSeconds: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhookEndpointId: string;
  eventId: string;
  eventType: WebhookEventType;
  status: "pending" | "delivered" | "failed" | "retrying";
  attempt: number;
  maxRetries: number;
  nextRetryAt?: string;
  lastAttemptAt?: string;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  errorMessage?: string;
  created_at: string;
  updated_at: string;
}
