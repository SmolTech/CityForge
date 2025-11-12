import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import { handleApiError, BadRequestError } from "@/lib/errors";

// File type validation
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

function isAllowedFile(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  return ext ? ALLOWED_EXTENSIONS.has(ext) : false;
}

function makeFilenameSecure(filename: string): string {
  // Remove any path traversal attempts and dangerous characters
  // Only allow alphanumeric, dots, underscores, and hyphens
  const cleaned = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".") // Replace multiple dots with single dot
    .replace(/^\.+|\.+$/g, "") // Remove leading/trailing dots
    .slice(0, 100); // Reasonable filename length limit

  // Ensure filename isn't empty after cleaning
  if (!cleaned || cleaned.length === 0) {
    return "upload_file";
  }

  return cleaned;
}

function isCloudinaryConfigured(): boolean {
  return !!(
    process.env["CLOUDINARY_CLOUD_NAME"] &&
    process.env["CLOUDINARY_API_KEY"] &&
    process.env["CLOUDINARY_API_SECRET"]
  );
}

function configureCloudinary(): void {
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  const apiKey = process.env["CLOUDINARY_API_KEY"];
  const apiSecret = process.env["CLOUDINARY_API_SECRET"];

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary configuration is incomplete");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

async function uploadToCloudinary(
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<{
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}> {
  try {
    if (!isCloudinaryConfigured()) {
      return { success: false, error: "Cloudinary not configured" };
    }

    configureCloudinary();

    // Convert ArrayBuffer to base64 for Cloudinary
    const base64File = Buffer.from(fileBuffer).toString("base64");
    const dataUrl = `data:image/${filename.split(".").pop()};base64,${base64File}`;

    const result = await cloudinary.uploader.upload(dataUrl, {
      folder: "cityforge/uploads",
      resource_type: "image",
      format: "auto", // Auto-optimize format (WebP when supported)
      quality: "auto:good", // Auto-optimize quality
      fetch_format: "auto", // Deliver optimal format
      flags: "progressive", // Progressive JPEG for better loading
      transformation: [
        { quality: "auto:good" },
        { fetch_format: "auto" },
        { width: 800, height: 600, crop: "limit" }, // Limit max size
        { flags: "progressive" },
      ],
    });

    logger.info(
      `Successfully uploaded image to Cloudinary: ${result.public_id}`
    );
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    logger.error("Failed to upload image to Cloudinary:", error);
    return { success: false, error: String(error) };
  }
}

async function uploadToLocal(
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<{
  success: boolean;
  url?: string;
  filename?: string;
  error?: string;
}> {
  try {
    const secureFilename = makeFilenameSecure(filename);
    const uniqueFilename = `${uuidv4()}_${secureFilename}`;

    // Ensure upload folder exists - use only configured upload directory
    const uploadFolder = process.env["UPLOAD_FOLDER"] || "uploads";
    const uploadPath = path.resolve(process.cwd(), uploadFolder);

    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    // Ensure the generated filename is safe before joining paths
    if (
      uniqueFilename.includes("..") ||
      uniqueFilename.includes("/") ||
      uniqueFilename.includes("\\")
    ) {
      throw new Error("Invalid filename generated");
    }

    // Safe: uniqueFilename is validated above to not contain .., /, or \
    const filePath = path.join(uploadPath, uniqueFilename); // nosemgrep

    // Verify the final path is still within the upload directory
    // Safe: we verify resolvedPath.startsWith(uploadPath) immediately after
    const resolvedPath = path.resolve(filePath); // nosemgrep
    if (!resolvedPath.startsWith(uploadPath)) {
      throw new Error("Invalid file path - outside upload directory");
    }

    const uint8Array = new Uint8Array(fileBuffer);
    await writeFile(filePath, uint8Array);

    logger.info(
      `Successfully uploaded file to local storage: ${uniqueFilename}`
    );
    return {
      success: true,
      filename: uniqueFilename,
      url: `/api/uploads/${uniqueFilename}`,
    };
  } catch (error) {
    logger.error("Failed to upload file to local storage:", error);
    return { success: false, error: String(error) };
  }
}

export const POST = withAuth(async (request: NextRequest) => {
  try {
    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      throw new BadRequestError("No file provided");
    }

    if (!file.name) {
      throw new BadRequestError("No file selected");
    }

    if (!isAllowedFile(file.name)) {
      throw new BadRequestError("Invalid file type");
    }

    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Try Cloudinary first if configured
    if (isCloudinaryConfigured()) {
      logger.info("Using Cloudinary for file upload");
      const cloudinaryResult = await uploadToCloudinary(fileBuffer, file.name);

      if (
        cloudinaryResult.success &&
        cloudinaryResult.url &&
        cloudinaryResult.publicId
      ) {
        return NextResponse.json({
          success: true,
          url: cloudinaryResult.url,
          public_id: cloudinaryResult.publicId,
          storage: "cloudinary",
          message: "File uploaded successfully to Cloudinary",
        });
      } else {
        logger.warn("Cloudinary upload failed, falling back to local storage");
      }
    }

    // Fallback to local storage
    logger.info("Using local storage for file upload");
    const localResult = await uploadToLocal(fileBuffer, file.name);

    if (localResult.success && localResult.url && localResult.filename) {
      return NextResponse.json({
        success: true,
        filename: localResult.filename,
        url: localResult.url,
        storage: "local",
        message: "File uploaded successfully to local storage",
      });
    } else {
      throw new Error(localResult.error || "Local upload failed");
    }
  } catch (error) {
    return handleApiError(error, "POST /api/upload");
  }
});
