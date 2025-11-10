import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createLogoutResponse } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/client";
import jwt from "jsonwebtoken";
import { logger } from "@/lib/logger";

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Extract token to get the jti for blacklisting
    let token: string | null = null;

    // Try Authorization header first (mobile)
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      // Try cookie (web)
      const cookieToken = request.cookies.get("access_token_cookie");
      if (cookieToken?.value) {
        token = cookieToken.value;
      }
    }

    if (!token) {
      return NextResponse.json({ message: "No token found" }, { status: 400 });
    }

    // Decode token to get jti and expiration
    const jwtSecret = process.env["JWT_SECRET_KEY"];
    if (!jwtSecret) {
      throw new Error("JWT_SECRET_KEY environment variable is not set");
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    const jti = decoded.jti;
    const exp = decoded.exp;

    if (!jti || !exp) {
      return NextResponse.json(
        { message: "Invalid token format" },
        { status: 400 }
      );
    }

    // Add token to blacklist
    const expiresAt = new Date(exp * 1000); // Convert from Unix timestamp

    await prisma.tokenBlacklist.create({
      data: {
        jti,
        tokenType: "access",
        userId: user.id,
        expiresAt,
        revokedAt: new Date(),
      },
    });

    logger.info(`User logged out: ${user.email}`);

    // Return response that clears the cookie
    return createLogoutResponse({ message: "Successfully logged out" });
  } catch (error) {
    logger.error("Logout error:", error);
    return NextResponse.json({ message: "Logout failed" }, { status: 500 });
  }
});
