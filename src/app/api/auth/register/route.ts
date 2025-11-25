import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { validateUserRegistration } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/password";
import { generateAccessToken, createAuthResponse } from "@/lib/auth/jwt";
import { withAuthRateLimit } from "@/lib/auth/rateLimit";
import {
  createEmailVerificationToken,
  sendVerificationEmail,
} from "@/lib/auth/email-verification";
import { businessMetrics } from "@/lib/monitoring/metrics";
import { logger } from "@/lib/logger";
import { handleApiError, ValidationError, ConflictError } from "@/lib/errors";

export const POST = withAuthRateLimit(
  "register",
  async function registerHandler(request: NextRequest) {
    try {
      const data = await request.json();

      // Validate input data
      const validation = validateUserRegistration(data);
      if (!validation.valid) {
        throw new ValidationError("Validation failed", validation.errors);
      }

      const { email, password, first_name, last_name } = validation.data!;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictError("Email already registered");
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: first_name,
          lastName: last_name,
          role: "user",
          isActive: true,
          emailVerified: false, // New users need email verification
          createdDate: new Date(),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          isSupporterFlag: true,
          createdDate: true,
          lastLogin: true,
        },
      });

      // Generate access token
      const token = generateAccessToken({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as "admin" | "supporter" | "user",
        isActive: user.isActive ?? true,
        emailVerified: user.emailVerified ?? false,
        isSupporterFlag: user.isSupporterFlag ?? false,
      });

      // Convert user to the format expected by frontend
      const userResponse = {
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        username: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        is_admin: user.role === "admin",
        is_supporter: user.role === "supporter" || user.role === "admin",
        is_supporter_flag: user.isSupporterFlag ?? false, // Use actual value from database
        is_active: user.isActive,
        email_verified: user.emailVerified, // Include email verification status
        created_date:
          user.createdDate?.toISOString() ?? new Date().toISOString(),
        last_login: user.lastLogin?.toISOString() || null,
      };

      logger.info(`New user registered: ${user.email}`);

      // Track user registration metric
      businessMetrics.userRegistered();

      // Generate and send email verification token
      try {
        const verificationToken = await createEmailVerificationToken(user.id);
        await sendVerificationEmail(
          user.email,
          verificationToken,
          `${user.firstName} ${user.lastName}`
        );
        logger.info(`Email verification sent to: ${user.email}`);
      } catch (emailError) {
        logger.error("Failed to send verification email", {
          email: user.email,
          error: emailError,
        });
        // Don't fail registration if email sending fails
      }

      // Return response with token in body (mobile) and httpOnly cookie (web)
      return createAuthResponse(
        {
          user: userResponse,
          message:
            "Registration successful. Please check your email to verify your account.",
        },
        token,
        201
      );
    } catch (error) {
      return handleApiError(error, "POST /api/auth/register");
    }
  }
);
