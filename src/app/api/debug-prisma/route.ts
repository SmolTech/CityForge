import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { redactDatabaseUrl } from "@/lib/utils/log-redaction";
import { logger } from "@/lib/logger";

export async function GET() {
  // Security check: Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "This debug endpoint is not available in production",
      },
      { status: 404 }
    );
  }

  try {
    // Log with redacted database URL
    const databaseUrl = process.env["DATABASE_URL"];
    logger.debug(
      "API Route DATABASE_URL:",
      databaseUrl ? redactDatabaseUrl(databaseUrl) : "NOT SET"
    );

    // Create a fresh Prisma client to test connection
    const prisma = new PrismaClient({
      log: ["error"],
    });

    const result = await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();

    return NextResponse.json({
      status: "success",
      databaseUrl: databaseUrl ? redactDatabaseUrl(databaseUrl) : "NOT SET", // Return redacted URL
      connectionTest: "success",
      result,
    });
  } catch (error) {
    logger.error("API Route Error:", error);
    const databaseUrl = process.env["DATABASE_URL"];

    return NextResponse.json({
      status: "error",
      databaseUrl: databaseUrl ? redactDatabaseUrl(databaseUrl) : "NOT SET", // Return redacted URL
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
