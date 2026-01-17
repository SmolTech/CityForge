import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { getEmailService } from "@/lib/email";

/**
 * Generate a secure email verification token
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create or update email verification token for a user
 */
export async function createEmailVerificationToken(
  userId: number
): Promise<string> {
  const token = generateVerificationToken();

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: token,
      emailVerificationSentAt: new Date(),
    },
  });

  logger.info("Email verification token created", { userId });
  return token;
}

/**
 * Verify email verification token and mark email as verified
 */
export async function verifyEmailToken(token: string): Promise<boolean> {
  if (!token || token.length !== 64) {
    return false;
  }

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerified: false,
    },
  });

  if (!user) {
    return false;
  }

  // Check if token is not older than 24 hours
  if (user.emailVerificationSentAt) {
    const tokenAge = Date.now() - user.emailVerificationSentAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (tokenAge > maxAge) {
      logger.warn("Expired email verification token used", {
        userId: user.id,
        email: user.email,
      });
      return false;
    }
  }

  // Mark email as verified and clear token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationSentAt: null,
    },
  });

  logger.info("Email verified successfully", {
    userId: user.id,
    email: user.email,
  });
  return true;
}

/**
 * Check if user's email is verified
 */
export async function isEmailVerified(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });

  return user?.emailVerified ?? false;
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  userName?: string
): Promise<void> {
  // Send webhook first (non-blocking)
  try {
    await sendEmailVerificationWebhook(email, token, userName);
  } catch (error) {
    logger.error("Failed to send email verification webhook", {
      email,
      error,
    });
  }

  const verificationUrl = `${process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000"}/verify-email?token=${token}`;

  const emailService = getEmailService();

  if (emailService) {
    try {
      await emailService.sendEmailVerification(
        email,
        verificationUrl,
        userName || email.split("@")[0] || "User"
      );

      logger.info("Email verification sent", {
        email,
      });
    } catch (error) {
      logger.error("Failed to send email verification", {
        email,
        error,
      });
      // Fall back to console logging in case of error
      console.log(`\n🔗 Email Verification Link for ${email}:`);
      console.log(`   ${verificationUrl}`);
      console.log(`\n⚠️  Email sending failed, showing link instead.\n`);
    }
  } else {
    // Development mode - log the verification URL
    logger.info("Email verification email would be sent", {
      email,
      verificationUrl,
      message: "Email service not configured, logging URL instead",
    });

    console.log(`\n🔗 Email Verification Link for ${email}:`);
    console.log(`   ${verificationUrl}`);
    console.log(`\n📧 In production, this would be sent via email service.\n`);
  }
}
