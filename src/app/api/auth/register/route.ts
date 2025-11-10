import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { validateUserRegistration } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/password";
import { generateAccessToken, createAuthResponse } from "@/lib/auth/jwt";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate input data
    const validation = validateUserRegistration(data);
    if (!validation.valid) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const { email, password, first_name, last_name } = validation.data!;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Email already registered" },
        { status: 400 }
      );
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
    const token = generateAccessToken(user);

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
      created_date: user.createdDate.toISOString(),
      last_login: user.lastLogin?.toISOString() || null,
    };

    logger.info(`New user registered: ${user.email}`);

    // Return response with token in body (mobile) and httpOnly cookie (web)
    return createAuthResponse({ user: userResponse }, token, 201);
  } catch (error) {
    logger.error("Registration error:", error);
    return NextResponse.json(
      { message: "Registration failed" },
      { status: 500 }
    );
  }
}
