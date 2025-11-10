import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET() {
  try {
    console.log("API Route DATABASE_URL:", process.env["DATABASE_URL"]);

    // Create a fresh Prisma client to test connection
    const prisma = new PrismaClient({
      log: ["error"],
    });

    const result = await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();

    return NextResponse.json({
      status: "success",
      databaseUrl: process.env["DATABASE_URL"],
      connectionTest: "success",
      result,
    });
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({
      status: "error",
      databaseUrl: process.env["DATABASE_URL"],
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
