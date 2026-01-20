import { createAndSendWebhookEvent } from "./service";
import {
  SubmissionCreatedEvent,
  ModificationCreatedEvent,
  ForumReportCreatedEvent,
  ForumCategoryRequestCreatedEvent,
  EmailVerificationRequestedEvent,
  PasswordResetRequestedEvent,
} from "./types";

/**
 * Send webhook for new business submission
 */
export async function sendSubmissionWebhook(
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
    created_date: Date | string;
  },
  submitter: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  }
): Promise<void> {
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";

  await createAndSendWebhookEvent<SubmissionCreatedEvent>(
    "submission.created",
    {
      submission: {
        ...submission,
        created_date:
          submission.created_date instanceof Date
            ? submission.created_date.toISOString()
            : submission.created_date,
      },
      submitter,
      admin_url: `${baseUrl}/admin/submissions`,
    }
  );
}

/**
 * Send webhook for business modification request
 */
export async function sendModificationWebhook(
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
    created_date: Date | string;
  },
  submitter: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  },
  card: {
    id: number;
    name: string;
  }
): Promise<void> {
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";

  await createAndSendWebhookEvent<ModificationCreatedEvent>(
    "modification.created",
    {
      modification: {
        ...modification,
        created_date:
          modification.created_date instanceof Date
            ? modification.created_date.toISOString()
            : modification.created_date,
      },
      submitter,
      card,
      admin_url: `${baseUrl}/admin/modifications`,
    }
  );
}

/**
 * Send webhook for forum post/thread report
 */
export async function sendForumReportWebhook(
  report: {
    id: number;
    reason: string;
    details?: string;
    created_date: Date | string;
  },
  thread: {
    id: number;
    title: string;
    slug: string;
    categoryId: number;
    category: {
      name: string;
      slug: string;
    };
  },
  reporter: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  },
  post?: {
    id: number;
    content: string;
  }
): Promise<void> {
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";

  await createAndSendWebhookEvent<ForumReportCreatedEvent>(
    "forum.report.created",
    {
      report: {
        ...report,
        created_date:
          report.created_date instanceof Date
            ? report.created_date.toISOString()
            : report.created_date,
      },
      thread,
      post,
      reporter,
      admin_url: `${baseUrl}/admin/forums/reports`,
    }
  );
}

/**
 * Send webhook for forum category request
 */
export async function sendCategoryRequestWebhook(
  request: {
    id: number;
    name: string;
    description: string;
    justification: string;
    status: string;
    created_date: Date | string;
  },
  requester: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  }
): Promise<void> {
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";

  await createAndSendWebhookEvent<ForumCategoryRequestCreatedEvent>(
    "forum.category_request.created",
    {
      request: {
        ...request,
        created_date:
          request.created_date instanceof Date
            ? request.created_date.toISOString()
            : request.created_date,
      },
      requester,
      admin_url: `${baseUrl}/admin/forums/category-requests`,
    }
  );
}

/**
 * Send webhook for email verification request
 */
export async function sendEmailVerificationWebhook(
  email: string,
  token: string,
  userName?: string
): Promise<void> {
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";

  await createAndSendWebhookEvent<EmailVerificationRequestedEvent>(
    "auth.email_verification.requested",
    {
      user: {
        email,
        firstName: userName,
      },
      verification_url: `${baseUrl}/verify-email?token=${token}`,
      token,
    }
  );
}

/**
 * Send webhook for password reset request
 */
export async function sendPasswordResetWebhook(
  email: string,
  token: string,
  expiresAt: Date,
  userName?: string
): Promise<void> {
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";

  await createAndSendWebhookEvent<PasswordResetRequestedEvent>(
    "auth.password_reset.requested",
    {
      user: {
        email,
        firstName: userName,
      },
      reset_url: `${baseUrl}/reset-password?token=${token}`,
      token,
      expires_at: expiresAt.toISOString(),
    }
  );
}
