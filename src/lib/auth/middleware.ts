import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

export interface AuthenticatedUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "supporter" | "user";
  isActive: boolean;
  emailVerified: boolean;
  isSupporterFlag: boolean;
  support: boolean;
}

export interface AuthMiddlewareOptions {
  requireAdmin?: boolean;
  optional?: boolean; // Allow unauthenticated requests
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor() {
    super("Token has expired", 401);
    this.name = "TokenExpiredError";
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message: string = "Invalid token") {
    super(message, 401);
    this.name = "InvalidTokenError";
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Extract JWT token from request (cookies or Authorization header)
 * Supports both web (cookies) and mobile (Authorization header) authentication
 */
function extractToken(request: NextRequest): string | null {
  // First try to get token from Authorization header (mobile)
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Then try to get token from cookies (web)
  const cookieToken = request.cookies.get("access_token_cookie");
  if (cookieToken?.value) {
    return cookieToken.value;
  }

  return null;
}

interface JWTPayload {
  sub: string;
  jti: string;
  type: string;
  iat: number;
  exp: number;
}

/**
 * Verify JWT token and extract payload
 */
function verifyToken(token: string): JWTPayload {
  const jwtSecret = process.env["JWT_SECRET_KEY"];
  if (!jwtSecret) {
    throw new Error("JWT_SECRET_KEY environment variable is not set");
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded === "string") {
      throw new InvalidTokenError("Invalid token format");
    }
    return decoded as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError("Invalid token");
    }
    // Re-throw our custom errors
    if (error instanceof InvalidTokenError) {
      throw error;
    }
    throw new InvalidTokenError("Token verification failed");
  }
}

/**
 * Check if token is blacklisted
 */
async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const blacklistedToken = await prisma.tokenBlacklist.findUnique({
    where: { jti },
  });

  return !!blacklistedToken;
}

/**
 * Load user from database and verify they're active
 */
async function loadUser(userId: number): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      emailVerified: true,
      isSupporterFlag: true,
      support: true,
    },
  });

  // Return null if user doesn't exist or is inactive
  if (!user || !user.isActive) {
    return null;
  }

  return user as AuthenticatedUser;
}

/**
 * Main authentication middleware function
 * Returns the authenticated user or throws an error
 */
export async function authenticate(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<AuthenticatedUser | null> {
  const { requireAdmin = false, optional = false } = options;

  try {
    // Extract token from request
    const token = extractToken(request);

    if (!token) {
      if (optional) {
        return null;
      }
      throw new AuthenticationError("No authentication token provided");
    }

    // Verify JWT token
    const payload = verifyToken(token);

    // Check if token is blacklisted
    const jti = payload.jti;
    if (!jti) {
      throw new InvalidTokenError("Invalid token format");
    }

    if (await isTokenBlacklisted(jti)) {
      throw new AuthenticationError("Token has been revoked");
    }

    // Load user
    const userId = parseInt(payload.sub);
    if (!userId) {
      throw new InvalidTokenError("Invalid token payload");
    }

    const user = await loadUser(userId);
    if (!user) {
      throw new AuthenticationError("User not found or inactive");
    }

    // Check admin requirement
    if (requireAdmin && user.role !== "admin") {
      throw new AuthorizationError("Admin access required");
    }

    return user;
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError
    ) {
      throw error;
    }

    logger.error("Authentication error:", error);
    throw new AuthenticationError("Authentication failed");
  }
}

/**
 * Higher-order function that wraps API route handlers with authentication
 * Usage:
 *
 * export const GET = withAuth(async (request, { user }) => {
 *   // user is guaranteed to be authenticated
 *   return NextResponse.json({ message: `Hello ${user.email}` });
 * });
 *
 * export const POST = withAuth(async (request, { user }) => {
 *   // Handle authenticated request
 * }, { requireAdmin: true });
 */
export function withAuth<T extends unknown[]>(
  handler: (
    request: NextRequest,
    context: { user: AuthenticatedUser },
    ...args: T
  ) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      console.log(
        "[AUTH] Starting authentication for",
        request.method,
        request.url
      );
      const user = await authenticate(request, options);

      if (!user && !options.optional) {
        console.log("[AUTH] Authentication required but no user found");
        return NextResponse.json(
          {
            error: {
              message: "Authentication required",
              code: 401,
            },
          },
          { status: 401 }
        );
      }

      console.log("[AUTH] Authentication successful, proceeding to handler");
      // Call the original handler with authenticated user
      return handler(request, { user: user! }, ...args);
    } catch (error) {
      console.error("[AUTH] Exception in withAuth:", error);
      if (error instanceof AuthenticationError) {
        return NextResponse.json(
          {
            error: {
              message: error.message,
              code: error.statusCode,
            },
          },
          { status: error.statusCode }
        );
      }

      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          {
            error: {
              message: error.message,
              code: error.statusCode,
            },
          },
          { status: error.statusCode }
        );
      }

      logger.error("Authentication middleware error:", error);
      return NextResponse.json(
        {
          error: {
            message: "Internal server error",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Optional authentication wrapper - allows both authenticated and unauthenticated requests
 * Usage:
 *
 * export const GET = withOptionalAuth(async (request, { user }) => {
 *   if (user) {
 *     // User is authenticated
 *     return NextResponse.json({ message: `Hello ${user.email}` });
 *   } else {
 *     // Anonymous user
 *     return NextResponse.json({ message: "Hello anonymous user" });
 *   }
 * });
 */
export function withOptionalAuth<T extends unknown[]>(
  handler: (
    request: NextRequest,
    context: { user: AuthenticatedUser | null },
    ...args: T
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const user = await authenticate(request, { optional: true });
      return handler(request, { user }, ...args);
    } catch (error) {
      // Only proceed with null user for expected authentication failures
      if (
        error instanceof AuthenticationError ||
        error instanceof AuthorizationError
      ) {
        logger.debug("Optional authentication failed:", error);
        return handler(request, { user: null }, ...args);
      }

      // Re-throw unexpected errors (database failures, system errors, etc.)
      logger.error("Unexpected error in optional authentication:", error);
      throw error;
    }
  };
}

/**
 * Helper function that throws if user is not authenticated
 * This is a convenience wrapper around authenticate for simple cases
 */
export async function requireAuth(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<AuthenticatedUser> {
  const user = await authenticate(request, options);
  if (!user) {
    throw new AuthenticationError("Authentication required");
  }
  return user;
}

/**
 * Check if a user has support permissions (can view/manage all support tickets)
 * Returns true if user is admin, has support flag, or legacy isSupporterFlag
 */
export function hasSupportPermissions(user: AuthenticatedUser): boolean {
  return (
    user.role === "admin" ||
    user.support === true ||
    user.isSupporterFlag === true
  );
}
