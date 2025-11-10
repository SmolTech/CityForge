import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withAuth(async (request: NextRequest, { user }) => {
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
    created_date: new Date().toISOString(), // Would need to fetch from DB for actual created date
    last_login: new Date().toISOString(), // Would need to fetch from DB for actual last login
  };

  return NextResponse.json({ user: userResponse });
});
