import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { createLogoutResponse } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/client";
import jwt from "jsonwebtoken";
import { logger } from "@/lib/logger";
import { handleApiError, BadRequestError } from "@/lib/errors";

export const POST = withCsrfProtection(
  withAuth(async (request: NextRequest, { user }) => {
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
        throw new BadRequestError("No token found");
      }

      // Decode token to get jti and expiration
      const jwtSecret = process.env["JWT_SECRET_KEY"];
      if (!jwtSecret) {
        throw new Error("JWT_SECRET_KEY environment variable is not set");
      }

      const decoded = jwt.verify(token, jwtSecret) as {
        jti?: string;
        exp?: number;
      };
      const jti = decoded.jti;
      const exp = decoded.exp;

      if (!jti || !exp) {
        throw new BadRequestError("Invalid token format");
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
      return handleApiError(error, "POST /api/auth/logout");
    }
  })
);
