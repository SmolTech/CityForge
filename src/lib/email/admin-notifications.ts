import { getEmailService } from "@/lib/email";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import {
  sendSubmissionWebhook,
  sendModificationWebhook,
  sendForumReportWebhook,
  sendCategoryRequestWebhook,
} from "@/lib/webhooks";

// Type definitions for submission and modification data
interface SubmissionData {
  id: number;
  name: string;
  description?: string | null;
  website_url?: string | null;
  phone_number?: string | null;
  email?: string | null;
  address?: string | null;
  contact_name?: string | null;
  tags_text?: string | null;
  created_date?: Date | string;
}

// Modification data has the same structure as submission data
type ModificationData = SubmissionData;

// Forum report data interface
interface ForumReportData {
  id: number;
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
  } | null;
  reason: string;
  details?: string | null;
  created_date?: Date | string;
}

// Forum category request data interface
interface ForumCategoryRequestData {
  id: number;
  name: string;
  description: string;
  justification: string;
  status: string;
  created_date?: Date | string;
}

export interface AdminNotificationData {
  type: "submission" | "modification" | "forum_report" | "category_request";
  data:
    | SubmissionData
    | ModificationData
    | ForumReportData
    | ForumCategoryRequestData;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  card?: {
    id: number;
    name: string;
  };
}

/**
 * Get all admin users' email addresses
 */
async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: "admin",
        isActive: true,
        emailVerified: true,
      },
      select: {
        email: true,
      },
    });

    return admins.map((admin) => admin.email);
  } catch (error) {
    logger.error("Failed to fetch admin emails", { error });
    return [];
  }
}

/**
 * Send email notification to all admins for new submissions
 */
export async function sendSubmissionNotification(
  submission: SubmissionData,
  submitter: { id: number; firstName: string; lastName: string; email: string }
): Promise<void> {
  // Send webhook first (non-blocking)
  try {
    await sendSubmissionWebhook(submission, submitter);
  } catch (error) {
    logger.error("Failed to send submission webhook", {
      submissionId: submission.id,
      error,
    });
  }

  const emailService = getEmailService();

  if (!emailService) {
    logger.info(
      "Email service not configured, logging submission notification",
      {
        submissionId: submission.id,
        submitterEmail: submitter.email,
      }
    );
    console.log(`\n📨 New Business Submission Notification:`);
    console.log(`   Submission ID: ${submission.id}`);
    console.log(`   Business Name: ${submission.name}`);
    console.log(
      `   Submitted by: ${submitter.firstName} ${submitter.lastName} (${submitter.email})`
    );
    console.log(`   Admin Review Required\n`);
    return;
  }

  const adminEmails = await getAdminEmails();

  if (adminEmails.length === 0) {
    logger.warn("No admin emails found for submission notification", {
      submissionId: submission.id,
    });
    return;
  }

  const subject = `New Business Submission: ${submission.name}`;
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";
  const adminUrl = `${baseUrl}/admin/submissions`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f9f9f9;
          border-radius: 8px;
          padding: 30px;
          margin: 20px 0;
        }
        .header {
          background-color: #3b82f6;
          color: white;
          padding: 20px;
          border-radius: 8px 8px 0 0;
          margin: -30px -30px 20px -30px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 8px;
          margin: 20px 0;
        }
        .detail-label {
          font-weight: bold;
          color: #666;
        }
        .detail-value {
          color: #333;
          word-break: break-word;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #3b82f6;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        }
        .footer {
          font-size: 14px;
          color: #666;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🏢 New Business Submission</h2>
          <p>A new business submission requires your review and approval.</p>
        </div>
        
        <h3>Business Details:</h3>
        <div class="detail-grid">
          <div class="detail-label">Name:</div>
          <div class="detail-value">${submission.name}</div>
          
          ${
            submission.description
              ? `
          <div class="detail-label">Description:</div>
          <div class="detail-value">${submission.description}</div>
          `
              : ""
          }
          
          ${
            submission.website_url
              ? `
          <div class="detail-label">Website:</div>
          <div class="detail-value"><a href="${submission.website_url}">${submission.website_url}</a></div>
          `
              : ""
          }
          
          ${
            submission.phone_number
              ? `
          <div class="detail-label">Phone:</div>
          <div class="detail-value">${submission.phone_number}</div>
          `
              : ""
          }
          
          ${
            submission.email
              ? `
          <div class="detail-label">Email:</div>
          <div class="detail-value">${submission.email}</div>
          `
              : ""
          }
          
          ${
            submission.address
              ? `
          <div class="detail-label">Address:</div>
          <div class="detail-value">${submission.address}</div>
          `
              : ""
          }
          
          ${
            submission.contact_name
              ? `
          <div class="detail-label">Contact Name:</div>
          <div class="detail-value">${submission.contact_name}</div>
          `
              : ""
          }
          
          ${
            submission.tags_text
              ? `
          <div class="detail-label">Tags:</div>
          <div class="detail-value">${submission.tags_text}</div>
          `
              : ""
          }
        </div>

        <h3>Submitted By:</h3>
        <div class="detail-grid">
          <div class="detail-label">Name:</div>
          <div class="detail-value">${submitter.firstName} ${submitter.lastName}</div>
          
          <div class="detail-label">Email:</div>
          <div class="detail-value">${submitter.email}</div>
          
          <div class="detail-label">Date:</div>
          <div class="detail-value">${submission.created_date ? new Date(submission.created_date).toLocaleString() : "Just now"}</div>
        </div>

        <a href="${adminUrl}" class="button">Review Submission</a>

        <div class="footer">
          <p>Please review this submission and approve or reject it from the admin dashboard.</p>
          <p>This is an automated notification email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Business Submission: ${submission.name}

Business Details:
- Name: ${submission.name}
${submission.description ? `- Description: ${submission.description}` : ""}
${submission.website_url ? `- Website: ${submission.website_url}` : ""}
${submission.phone_number ? `- Phone: ${submission.phone_number}` : ""}
${submission.email ? `- Email: ${submission.email}` : ""}
${submission.address ? `- Address: ${submission.address}` : ""}
${submission.contact_name ? `- Contact Name: ${submission.contact_name}` : ""}
${submission.tags_text ? `- Tags: ${submission.tags_text}` : ""}

Submitted By: ${submitter.firstName} ${submitter.lastName} (${submitter.email})
Date: ${submission.created_date ? new Date(submission.created_date).toLocaleString() : "Just now"}

Review submission: ${adminUrl}
  `;

  // Send email to all admins
  for (const adminEmail of adminEmails) {
    try {
      await emailService.sendEmail({
        to: adminEmail,
        subject,
        html,
        text,
      });

      logger.info("Submission notification sent to admin", {
        adminEmail,
        submissionId: submission.id,
      });
    } catch (error) {
      logger.error("Failed to send submission notification to admin", {
        adminEmail,
        submissionId: submission.id,
        error,
      });
    }
  }
}

/**
 * Send email notification to all admins for card modification suggestions
 */
export async function sendModificationNotification(
  modification: ModificationData,
  submitter: { id: number; firstName: string; lastName: string; email: string },
  card: { id: number; name: string }
): Promise<void> {
  // Send webhook first (non-blocking)
  try {
    await sendModificationWebhook(modification, submitter, card);
  } catch (error) {
    logger.error("Failed to send modification webhook", {
      modificationId: modification.id,
      error,
    });
  }

  const emailService = getEmailService();

  if (!emailService) {
    logger.info(
      "Email service not configured, logging modification notification",
      {
        modificationId: modification.id,
        cardId: card.id,
        submitterEmail: submitter.email,
      }
    );
    console.log(`\n✏️ Business Modification Notification:`);
    console.log(`   Modification ID: ${modification.id}`);
    console.log(`   Original Business: ${card.name}`);
    console.log(`   Suggested Name: ${modification.name}`);
    console.log(
      `   Submitted by: ${submitter.firstName} ${submitter.lastName} (${submitter.email})`
    );
    console.log(`   Admin Review Required\n`);
    return;
  }

  const adminEmails = await getAdminEmails();

  if (adminEmails.length === 0) {
    logger.warn("No admin emails found for modification notification", {
      modificationId: modification.id,
    });
    return;
  }

  const subject = `Business Modification: ${card.name}`;
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";
  const adminUrl = `${baseUrl}/admin/modifications`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f9f9f9;
          border-radius: 8px;
          padding: 30px;
          margin: 20px 0;
        }
        .header {
          background-color: #f59e0b;
          color: white;
          padding: 20px;
          border-radius: 8px 8px 0 0;
          margin: -30px -30px 20px -30px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 8px;
          margin: 20px 0;
        }
        .detail-label {
          font-weight: bold;
          color: #666;
        }
        .detail-value {
          color: #333;
          word-break: break-word;
        }
        .comparison {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #f59e0b;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        }
        .footer {
          font-size: 14px;
          color: #666;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✏️ Business Modification Suggestion</h2>
          <p>A user has suggested changes to an existing business listing.</p>
        </div>
        
        <div class="comparison">
          <h3>Original Business: ${card.name}</h3>
          <p>Changes have been suggested for this existing listing.</p>
        </div>

        <h3>Suggested Changes:</h3>
        <div class="detail-grid">
          <div class="detail-label">Name:</div>
          <div class="detail-value">${modification.name}</div>
          
          ${
            modification.description
              ? `
          <div class="detail-label">Description:</div>
          <div class="detail-value">${modification.description}</div>
          `
              : ""
          }
          
          ${
            modification.website_url
              ? `
          <div class="detail-label">Website:</div>
          <div class="detail-value"><a href="${modification.website_url}">${modification.website_url}</a></div>
          `
              : ""
          }
          
          ${
            modification.phone_number
              ? `
          <div class="detail-label">Phone:</div>
          <div class="detail-value">${modification.phone_number}</div>
          `
              : ""
          }
          
          ${
            modification.email
              ? `
          <div class="detail-label">Email:</div>
          <div class="detail-value">${modification.email}</div>
          `
              : ""
          }
          
          ${
            modification.address
              ? `
          <div class="detail-label">Address:</div>
          <div class="detail-value">${modification.address}</div>
          `
              : ""
          }
          
          ${
            modification.contact_name
              ? `
          <div class="detail-label">Contact Name:</div>
          <div class="detail-value">${modification.contact_name}</div>
          `
              : ""
          }
          
          ${
            modification.tags_text
              ? `
          <div class="detail-label">Tags:</div>
          <div class="detail-value">${modification.tags_text}</div>
          `
              : ""
          }
        </div>

        <h3>Suggested By:</h3>
        <div class="detail-grid">
          <div class="detail-label">Name:</div>
          <div class="detail-value">${submitter.firstName} ${submitter.lastName}</div>
          
          <div class="detail-label">Email:</div>
          <div class="detail-value">${submitter.email}</div>
          
          <div class="detail-label">Date:</div>
          <div class="detail-value">${modification.created_date ? new Date(modification.created_date).toLocaleString() : "Just now"}</div>
        </div>

        <a href="${adminUrl}" class="button">Review Modification</a>

        <div class="footer">
          <p>Please review these suggested changes and approve or reject them from the admin dashboard.</p>
          <p>This is an automated notification email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Business Modification Suggestion: ${card.name}

Original Business: ${card.name}

Suggested Changes:
- Name: ${modification.name}
${modification.description ? `- Description: ${modification.description}` : ""}
${modification.website_url ? `- Website: ${modification.website_url}` : ""}
${modification.phone_number ? `- Phone: ${modification.phone_number}` : ""}
${modification.email ? `- Email: ${modification.email}` : ""}
${modification.address ? `- Address: ${modification.address}` : ""}
${modification.contact_name ? `- Contact Name: ${modification.contact_name}` : ""}
${modification.tags_text ? `- Tags: ${modification.tags_text}` : ""}

Suggested By: ${submitter.firstName} ${submitter.lastName} (${submitter.email})
Date: ${modification.created_date ? new Date(modification.created_date).toLocaleString() : "Just now"}

Review modification: ${adminUrl}
  `;

  // Send email to all admins
  for (const adminEmail of adminEmails) {
    try {
      await emailService.sendEmail({
        to: adminEmail,
        subject,
        html,
        text,
      });

      logger.info("Modification notification sent to admin", {
        adminEmail,
        modificationId: modification.id,
        cardId: card.id,
      });
    } catch (error) {
      logger.error("Failed to send modification notification to admin", {
        adminEmail,
        modificationId: modification.id,
        cardId: card.id,
        error,
      });
    }
  }
}

/**
 * Send email notification to all admins for forum reports
 */
export async function sendForumReportNotification(
  report: ForumReportData,
  reporter: { id: number; firstName: string; lastName: string; email: string }
): Promise<void> {
  // Send webhook first (non-blocking)
  try {
    await sendForumReportWebhook(report, report.thread, reporter, report.post);
  } catch (error) {
    logger.error("Failed to send forum report webhook", {
      reportId: report.id,
      error,
    });
  }

  const emailService = getEmailService();

  if (!emailService) {
    logger.info(
      "Email service not configured, logging forum report notification",
      {
        reportId: report.id,
        threadId: report.thread.id,
        reporterEmail: reporter.email,
      }
    );
    console.log(`\n🚨 Forum Report Notification:`);
    console.log(`   Report ID: ${report.id}`);
    console.log(`   Thread: ${report.thread.title}`);
    console.log(`   Category: ${report.thread.category.name}`);
    if (report.post) {
      console.log(`   Reported Post: ${report.post.id}`);
    } else {
      console.log(`   Reported: Entire Thread`);
    }
    console.log(`   Reason: ${report.reason}`);
    console.log(
      `   Reported by: ${reporter.firstName} ${reporter.lastName} (${reporter.email})`
    );
    console.log(`   Admin Action Required\n`);
    return;
  }

  const adminEmails = await getAdminEmails();

  if (adminEmails.length === 0) {
    logger.warn("No admin emails found for forum report notification", {
      reportId: report.id,
    });
    return;
  }

  const reportType = report.post ? "Post" : "Thread";
  const subject = `🚨 Forum ${reportType} Reported: ${report.thread.title}`;
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";
  const adminUrl = `${baseUrl}/admin/forums`;
  const contentUrl = report.post
    ? `${baseUrl}/forums/${report.thread.category.slug}/${report.thread.id}#post-${report.post.id}`
    : `${baseUrl}/forums/${report.thread.category.slug}/${report.thread.id}`;

  // Truncate post content for preview (max 200 characters)
  const contentPreview = report.post
    ? report.post.content.length > 200
      ? `${report.post.content.substring(0, 200)}...`
      : report.post.content
    : null;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f9f9f9;
          border-radius: 8px;
          padding: 30px;
          margin: 20px 0;
        }
        .header {
          background-color: #dc2626;
          color: white;
          padding: 20px;
          border-radius: 8px 8px 0 0;
          margin: -30px -30px 20px -30px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 8px;
          margin: 20px 0;
        }
        .detail-label {
          font-weight: bold;
          color: #666;
        }
        .detail-value {
          color: #333;
          word-break: break-word;
        }
        .content-preview {
          background-color: #fee2e2;
          border-left: 4px solid #dc2626;
          padding: 12px;
          margin: 20px 0;
          font-style: italic;
        }
        .alert-box {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 16px;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #dc2626;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 8px 8px 8px 0;
        }
        .button.secondary {
          background-color: #6b7280;
        }
        .footer {
          font-size: 14px;
          color: #666;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🚨 Forum ${reportType} Reported</h2>
          <p>A forum ${reportType.toLowerCase()} has been reported and requires immediate attention.</p>
        </div>
        
        <div class="alert-box">
          <strong>⚠️ Action Required:</strong> This report needs to be reviewed and appropriate action taken.
        </div>

        <h3>${reportType} Details:</h3>
        <div class="detail-grid">
          <div class="detail-label">Thread:</div>
          <div class="detail-value"><a href="${contentUrl}">${report.thread.title}</a></div>
          
          <div class="detail-label">Category:</div>
          <div class="detail-value">${report.thread.category.name}</div>
          
          ${
            report.post
              ? `
          <div class="detail-label">Post ID:</div>
          <div class="detail-value">${report.post.id}</div>
          `
              : ""
          }
        </div>

        ${
          contentPreview
            ? `
        <h3>Reported Content Preview:</h3>
        <div class="content-preview">
          "${contentPreview}"
        </div>
        `
            : ""
        }

        <h3>Report Details:</h3>
        <div class="detail-grid">
          <div class="detail-label">Reason:</div>
          <div class="detail-value">${report.reason}</div>
          
          ${
            report.details
              ? `
          <div class="detail-label">Additional Details:</div>
          <div class="detail-value">${report.details}</div>
          `
              : ""
          }
        </div>

        <h3>Reported By:</h3>
        <div class="detail-grid">
          <div class="detail-label">Name:</div>
          <div class="detail-value">${reporter.firstName} ${reporter.lastName}</div>
          
          <div class="detail-label">Email:</div>
          <div class="detail-value">${reporter.email}</div>
          
          <div class="detail-label">Date:</div>
          <div class="detail-value">${report.created_date ? new Date(report.created_date).toLocaleString() : "Just now"}</div>
        </div>

        <div style="margin: 30px 0;">
          <a href="${adminUrl}" class="button">Admin Dashboard</a>
          <a href="${contentUrl}" class="button secondary">View ${reportType}</a>
        </div>

        <div class="footer">
          <p><strong>Priority:</strong> Forum reports require prompt attention to maintain community standards.</p>
          <p>Please review this report and take appropriate action (resolve, delete post, delete thread).</p>
          <p>This is an automated notification email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
🚨 Forum ${reportType} Reported: ${report.thread.title}

${reportType} Details:
- Thread: ${report.thread.title}
- Category: ${report.thread.category.name}
${report.post ? `- Post ID: ${report.post.id}` : ""}

${
  contentPreview
    ? `
Reported Content Preview:
"${contentPreview}"
`
    : ""
}

Report Details:
- Reason: ${report.reason}
${report.details ? `- Additional Details: ${report.details}` : ""}

Reported By: ${reporter.firstName} ${reporter.lastName} (${reporter.email})
Date: ${report.created_date ? new Date(report.created_date).toLocaleString() : "Just now"}

Actions:
- Admin Dashboard: ${adminUrl}
- View ${reportType}: ${contentUrl}

⚠️ Priority: Forum reports require prompt attention to maintain community standards.
Please review this report and take appropriate action.
  `;

  // Send email to all admins
  for (const adminEmail of adminEmails) {
    try {
      await emailService.sendEmail({
        to: adminEmail,
        subject,
        html,
        text,
      });

      logger.info("Forum report notification sent to admin", {
        adminEmail,
        reportId: report.id,
        threadId: report.thread.id,
        postId: report.post?.id,
      });
    } catch (error) {
      logger.error("Failed to send forum report notification to admin", {
        adminEmail,
        reportId: report.id,
        threadId: report.thread.id,
        postId: report.post?.id,
        error,
      });
    }
  }
}

/**
 * Send email notification to all admins for forum category requests
 */
export async function sendCategoryRequestNotification(
  request: ForumCategoryRequestData,
  requester: { id: number; firstName: string; lastName: string; email: string }
): Promise<void> {
  // Send webhook first (non-blocking)
  try {
    await sendCategoryRequestWebhook(request, requester);
  } catch (error) {
    logger.error("Failed to send category request webhook", {
      requestId: request.id,
      error,
    });
  }

  const emailService = getEmailService();

  if (!emailService) {
    logger.info(
      "Email service not configured, logging category request notification",
      {
        requestId: request.id,
        requesterEmail: requester.email,
      }
    );
    console.log(`\n🏷️ Forum Category Request Notification:`);
    console.log(`   Request ID: ${request.id}`);
    console.log(`   Category Name: ${request.name}`);
    console.log(
      `   Requested by: ${requester.firstName} ${requester.lastName} (${requester.email})`
    );
    console.log(`   Admin Review Required\n`);
    return;
  }

  const adminEmails = await getAdminEmails();

  if (adminEmails.length === 0) {
    logger.warn("No admin emails found for category request notification", {
      requestId: request.id,
    });
    return;
  }

  const subject = `New Forum Category Request: ${request.name}`;
  const baseUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";
  const adminUrl = `${baseUrl}/admin/forums`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f9f9f9;
          border-radius: 8px;
          padding: 30px;
          margin: 20px 0;
        }
        .header {
          background-color: #8b5cf6;
          color: white;
          padding: 20px;
          border-radius: 8px 8px 0 0;
          margin: -30px -30px 20px -30px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 8px;
          margin: 20px 0;
        }
        .detail-label {
          font-weight: bold;
          color: #666;
        }
        .detail-value {
          color: #333;
          word-break: break-word;
        }
        .justification {
          background-color: #f3f4f6;
          border-left: 4px solid #8b5cf6;
          padding: 16px;
          margin: 20px 0;
          border-radius: 0 6px 6px 0;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #8b5cf6;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        }
        .footer {
          font-size: 14px;
          color: #666;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🏷️ New Forum Category Request</h2>
          <p>A community member has requested a new forum category for approval.</p>
        </div>
        
        <h3>Category Request:</h3>
        <div class="detail-grid">
          <div class="detail-label">Name:</div>
          <div class="detail-value">${request.name}</div>
          
          <div class="detail-label">Description:</div>
          <div class="detail-value">${request.description}</div>
          
          <div class="detail-label">Status:</div>
          <div class="detail-value">${request.status}</div>
        </div>

        <h3>Justification:</h3>
        <div class="justification">
          "${request.justification}"
        </div>

        <h3>Requested By:</h3>
        <div class="detail-grid">
          <div class="detail-label">Name:</div>
          <div class="detail-value">${requester.firstName} ${requester.lastName}</div>
          
          <div class="detail-label">Email:</div>
          <div class="detail-value">${requester.email}</div>
          
          <div class="detail-label">Date:</div>
          <div class="detail-value">${request.created_date ? new Date(request.created_date).toLocaleString() : "Just now"}</div>
        </div>

        <a href="${adminUrl}" class="button">Review Request</a>

        <div class="footer">
          <p>Please review this category request and approve or reject it from the forum admin section.</p>
          <p>Approved categories will be automatically created and made available to the community.</p>
          <p>This is an automated notification email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Forum Category Request: ${request.name}

Category Request:
- Name: ${request.name}
- Description: ${request.description}
- Status: ${request.status}

Justification: "${request.justification}"

Requested By: ${requester.firstName} ${requester.lastName} (${requester.email})
Date: ${request.created_date ? new Date(request.created_date).toLocaleString() : "Just now"}

Review request: ${adminUrl}

Please review this category request and approve or reject it from the forum admin section.
  `;

  // Send email to all admins
  for (const adminEmail of adminEmails) {
    try {
      await emailService.sendEmail({
        to: adminEmail,
        subject,
        html,
        text,
      });

      logger.info("Category request notification sent to admin", {
        adminEmail,
        requestId: request.id,
      });
    } catch (error) {
      logger.error("Failed to send category request notification to admin", {
        adminEmail,
        requestId: request.id,
        error,
      });
    }
  }
}
