import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

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
 * Send email verification email (placeholder - implement with your email service)
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  // TODO: Implement with actual email service (SendGrid, AWS SES, etc.)
  // For now, just log the verification URL
  const verificationUrl = `${process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000"}/verify-email?token=${token}`;

  logger.info("Email verification email would be sent", {
    email,
    verificationUrl,
    message: "In production, implement this with your email service",
  });

  console.log(`\n🔗 Email Verification Link for ${email}:`);
  console.log(`   ${verificationUrl}`);
  console.log(`\n📧 In production, this would be sent via email service.\n`);
}
