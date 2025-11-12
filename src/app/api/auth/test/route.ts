import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";

// Test route to verify authentication middleware works
export const GET = withAuth(async (_request: NextRequest, { user }) => {
  // Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    message: "Authentication successful",
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
});

// Admin-only test route
export const POST = withAuth(
  async (_request: NextRequest, { user }) => {
    // Only allow in development environment
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Admin access granted",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  },
  { requireAdmin: true }
);
