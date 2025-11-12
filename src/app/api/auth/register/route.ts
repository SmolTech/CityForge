import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { validateUserRegistration } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/password";
import { generateAccessToken, createAuthResponse } from "@/lib/auth/jwt";
import { logger } from "@/lib/logger";
import { handleApiError, ValidationError, ConflictError } from "@/lib/errors";

export async function POST(request: NextRequest) {
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
        createdDate: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdDate: true,
        lastLogin: true,
      },
    });

    // Generate access token
    const token = generateAccessToken({
      ...user,
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
      last_login: user.lastLogin?.toISOString() || null,
    };

    logger.info(`New user registered: ${user.email}`);

    // Return response with token in body (mobile) and httpOnly cookie (web)
    return createAuthResponse({ user: userResponse }, token, 201);
  } catch (error) {
    return handleApiError(error, "POST /api/auth/register");
  }
}
