import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ filename: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { filename } = await params;

  try {
    // Validate filename to prevent directory traversal
    if (
      !filename ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("\0") || // null byte injection
      filename.length > 255 || // prevent extremely long filenames
      !/^[a-zA-Z0-9._-]+$/.test(filename) // only allow safe characters
    ) {
      logger.warn(`Invalid filename requested: ${filename}`);
      return NextResponse.json(
        { message: "Invalid filename" },
        { status: 400 }
      );
    }

    const uploadFolder = process.env["UPLOAD_FOLDER"] || "uploads";
    const uploadPath = path.resolve(process.cwd(), uploadFolder);
    const filePath = path.resolve(uploadPath, filename);

    // Verify the resolved path is still within the upload directory
    if (
      !filePath.startsWith(uploadPath + path.sep) &&
      filePath !== uploadPath
    ) {
      logger.warn(`Path traversal attempt detected: ${filename}`);
      return NextResponse.json(
        { message: "Invalid file path" },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      logger.warn(`File not found: ${filename}`);
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    // Read the file
    const fileBuffer = await readFile(filePath);

    // Determine content type based on file extension
    const ext = filename.toLowerCase().split(".").pop();
    let contentType = "application/octet-stream"; // Default fallback

    switch (ext) {
      case "png":
        contentType = "image/png";
        break;
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg";
        break;
      case "gif":
        contentType = "image/gif";
        break;
      case "webp":
        contentType = "image/webp";
        break;
    }

    // Return the file with appropriate headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error(`Error serving file ${filename}:`, error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
