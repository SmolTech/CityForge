import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { validateUserLogin } from "@/lib/auth/validation";
import { verifyPassword } from "@/lib/auth/password";
import { generateAccessToken, createAuthResponse } from "@/lib/auth/jwt";
import { logger } from "@/lib/logger";
import {
  handleApiError,
  ValidationError,
  UnauthorizedError,
} from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate input data
    const validation = validateUserLogin(data);
    if (!validation.valid) {
      throw new ValidationError("Validation failed", validation.errors);
    }

    const { email, password } = validation.data!;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdDate: true,
        lastLogin: true,
      },
    });

    // Check if user exists, password is correct, and user is active
    if (
      !user ||
      !user.isActive ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate access token
    const token = generateAccessToken({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as "admin" | "supporter" | "user",
      isActive: user.isActive ?? true,
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
      is_supporter_flag: false, // Not implemented in this schema yet
      is_active: user.isActive,
      created_date: user.createdDate?.toISOString() ?? new Date().toISOString(),
      last_login: new Date().toISOString(), // Use current time since we just updated it
    };

    logger.info(`User logged in: ${user.email}`);

    // Return response with token in body (mobile) and httpOnly cookie (web)
    return createAuthResponse({ user: userResponse }, token);
  } catch (error) {
    return handleApiError(error, "POST /api/auth/login");
  }
}
