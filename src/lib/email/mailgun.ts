import { logger } from "../logger";

interface MailgunEmailConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName?: string;
  region?: "us" | "eu"; // Mailgun supports US and EU regions
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email service using Mailgun API
 * https://documentation.mailgun.com/en/latest/api-sending.html
 */
export class MailgunEmailService {
  private config: MailgunEmailConfig;
  private baseUrl: string;

  constructor(config: MailgunEmailConfig) {
    this.config = config;
    // Mailgun has different API endpoints for US and EU
    const region = config.region || "us";
    this.baseUrl =
      region === "eu"
        ? "https://api.eu.mailgun.net/v3"
        : "https://api.mailgun.net/v3";
  }

  /**
   * Send an email using Mailgun API
   */
  async sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
    try {
      const url = `${this.baseUrl}/${this.config.domain}/messages`;

      // Mailgun uses form-encoded data
      const formData = new URLSearchParams();
      formData.append(
        "from",
        this.config.fromName
          ? `${this.config.fromName} <${this.config.fromEmail}>`
          : this.config.fromEmail
      );
      formData.append("to", to);
      formData.append("subject", subject);
      formData.append("html", html);
      if (text) {
        formData.append("text", text);
      }

      // Mailgun uses HTTP Basic Auth with "api" as username
      const auth = Buffer.from(`api:${this.config.apiKey}`).toString("base64");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Email sending failed: ${error}`);
      }

      const result = await response.json();
      logger.info("Email sent successfully", {
        to,
        subject,
        messageId: result.id,
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
export function getEmailService(): MailgunEmailService | null {
  const apiKey = process.env["MAILGUN_API_KEY"];
  const domain = process.env["MAILGUN_DOMAIN"];
  const fromEmail = process.env["EMAIL_FROM"];

  // In development, email service is optional
  if (!apiKey || !domain || !fromEmail) {
    if (process.env["NODE_ENV"] === "production") {
      logger.error("Email service not configured in production", {
        hasApiKey: !!apiKey,
        hasDomain: !!domain,
        hasFromEmail: !!fromEmail,
      });
    } else {
      logger.warn("Email service not configured, emails will be logged only");
    }
    return null;
  }

  return new MailgunEmailService({
    apiKey,
    domain,
    fromEmail,
    fromName: process.env["EMAIL_FROM_NAME"] || "CityForge",
    region: (process.env["MAILGUN_REGION"] as "us" | "eu") || "us",
  });
}
