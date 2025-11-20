import { logger } from "../logger";

interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
  fromEmail: string;
  fromName?: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email service using Cloudflare Email Routing with MailChannels
 * https://developers.cloudflare.com/email-routing/
 */
export class CloudflareEmailService {
  private config: CloudflareEmailConfig;

  constructor(config: CloudflareEmailConfig) {
    this.config = config;
  }

  /**
   * Send an email using Cloudflare Workers and MailChannels
   */
  async sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
    try {
      // Cloudflare uses MailChannels API for outbound delivery
      // The actual endpoint will be your Cloudflare Worker that handles email sending
      const workerUrl = `https://api.mailchannels.net/tx/v1/send`;

      const payload = {
        personalizations: [
          {
            to: [{ email: to }],
          },
        ],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName || this.config.fromEmail,
        },
        subject,
        content: [
          ...(text ? [{ type: "text/plain", value: text }] : []),
          { type: "text/html", value: html },
        ],
      };

      // Use Cloudflare API token for authentication
      const response = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiToken}`,
          "X-Account-Id": this.config.accountId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Email sending failed: ${error}`);
      }

      logger.info("Email sent successfully", {
        to,
        subject,
      });
    } catch (error) {
      logger.error("Failed to send email", {
        to,
        subject,
        error,
      });
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    userName: string
  ): Promise<void> {
    const subject = "Password Reset Request";
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
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Reset Request</h2>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>

          <a href="${resetUrl}" class="button">Reset Password</a>

          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>

          <div class="warning">
            <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </div>

          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hi ${userName},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

If you have any questions, please contact our support team.
    `;

    await this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send email verification email
   */
  async sendEmailVerification(
    to: string,
    verificationUrl: string,
    userName: string
  ): Promise<void> {
    const subject = "Verify Your Email Address";
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
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #10b981;
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
          <h2>Welcome! Verify Your Email</h2>
          <p>Hi ${userName},</p>
          <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>

          <a href="${verificationUrl}" class="button">Verify Email</a>

          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #10b981;">${verificationUrl}</p>

          <div class="footer">
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hi ${userName},

Thank you for signing up! Please verify your email address by clicking the link below:

${verificationUrl}

If you didn't create an account, you can safely ignore this email.
    `;

    await this.sendEmail({ to, subject, html, text });
  }
}

/**
 * Get configured email service instance
 */
export function getEmailService(): CloudflareEmailService | null {
  const apiToken = process.env["CLOUDFLARE_EMAIL_API_TOKEN"];
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const fromEmail = process.env["EMAIL_FROM"];

  // In development, email service is optional
  if (!apiToken || !accountId || !fromEmail) {
    if (process.env["NODE_ENV"] === "production") {
      logger.error("Email service not configured in production", {
        hasApiToken: !!apiToken,
        hasAccountId: !!accountId,
        hasFromEmail: !!fromEmail,
      });
    } else {
      logger.warn("Email service not configured, emails will be logged only");
    }
    return null;
  }

  return new CloudflareEmailService({
    apiToken,
    accountId,
    fromEmail,
    fromName: process.env["EMAIL_FROM_NAME"] || "CityForge",
  });
}
