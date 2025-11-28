import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { AuthenticatedUser } from "./middleware";
import { generateCsrfToken, setCsrfCookie, clearCsrfCookie } from "./csrf";

export interface JWTPayload {
  sub: string; // User ID
  jti: string; // JWT ID for blacklisting
  type: "access";
  iat: number; // Issued at
  exp: number; // Expires at
}

/**
 * Generate a JWT access token for a user
 */
export function generateAccessToken(user: AuthenticatedUser): string {
  const jwtSecret = process.env["JWT_SECRET_KEY"];
  if (!jwtSecret) {
    throw new Error("JWT_SECRET_KEY environment variable is not set");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 24 * 60 * 60; // 24 hours in seconds

  const payload: JWTPayload = {
    sub: user.id.toString(),
    jti: uuidv4(), // Unique token ID for blacklisting
    type: "access",
    iat: now,
    exp: now + expiresIn,
  };

  return jwt.sign(payload, jwtSecret, {
    algorithm: "HS256",
  });
}

/**
 * Create a response with httpOnly cookie (for web) and token in body (for mobile)
 */
export function createAuthResponse(
  data: Record<string, unknown>,
  token: string,
  status: number = 200
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";

  const response = NextResponse.json(
    { ...data, access_token: token },
    { status }
  );

  // Set httpOnly cookie for web authentication
  response.cookies.set("access_token_cookie", token, {
    httpOnly: true,
    path: "/",
    maxAge: 24 * 60 * 60, // 24 hours
    sameSite: "lax",
    secure: isProduction,
  });

  // Generate and set CSRF token for web clients
  // Mobile clients using Bearer tokens don't need this
  const csrfToken = generateCsrfToken();
  setCsrfCookie(response, csrfToken);

  return response;
}

/**
 * Create a response that clears the authentication cookie
 */
export function createLogoutResponse(
  data: Record<string, unknown>,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });

  // Clear httpOnly cookie
  response.cookies.set("access_token_cookie", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });

  // Clear CSRF token cookie
  clearCsrfCookie(response);

  return response;
}
