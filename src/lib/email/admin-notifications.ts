import { getEmailService } from "@/lib/email";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

export interface AdminNotificationData {
  type: "submission" | "modification";
  data: any;
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
  submission: any,
  submitter: { id: number; firstName: string; lastName: string; email: string }
): Promise<void> {
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
  modification: any,
  submitter: { id: number; firstName: string; lastName: string; email: string },
  card: { id: number; name: string }
): Promise<void> {
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
