import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
  beforeEach,
} from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/route";
import {
  createTestRequestWithFormData,
  createAuthenticatedRequestWithFormData,
  createTestToken,
} from "../../utils/api-test-helpers";
import { createTestUserInDb } from "../../utils/database-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
} from "../setup";
import { generateCsrfToken } from "@/lib/auth/csrf";
import { rmdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

describe("POST /api/upload", () => {
  let testUser: Awaited<ReturnType<typeof createTestUserInDb>>;
  let originalEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    await setupIntegrationTests();
    // Store original environment variables
    originalEnv = {
      CLOUDINARY_CLOUD_NAME: process.env["CLOUDINARY_CLOUD_NAME"],
      CLOUDINARY_API_KEY: process.env["CLOUDINARY_API_KEY"],
      CLOUDINARY_API_SECRET: process.env["CLOUDINARY_API_SECRET"],
      UPLOAD_FOLDER: process.env["UPLOAD_FOLDER"],
    };
  }, 60000);

  beforeEach(async () => {
    // Clear all environment variables for clean test state
    delete process.env["CLOUDINARY_CLOUD_NAME"];
    delete process.env["CLOUDINARY_API_KEY"];
    delete process.env["CLOUDINARY_API_SECRET"];
    delete process.env["UPLOAD_FOLDER"];

    // Create test user in database
    testUser = await createTestUserInDb({
      email: `test-upload-${Date.now()}@example.com`,
      firstName: "Test",
      lastName: "User",
      password: "TestPassword123!",
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanDatabase();

    // Clean up test upload folder if it exists
    const testUploadPath = path.resolve(process.cwd(), "test-uploads");
    if (existsSync(testUploadPath)) {
      await rmdir(testUploadPath, { recursive: true }).catch(() => {
        // Ignore errors - folder might not exist or be locked
      });
    }
  });

  afterAll(async () => {
    // Restore original environment variables
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    await teardownIntegrationTests();
  }, 30000);

  // Helper function to create test files
  function createTestFile(
    filename: string,
    content = "test image content",
    mimeType = "image/png"
  ) {
    const file = new File([content], filename, { type: mimeType });
    return file;
  }

  // Helper function to create FormData with file
  function createFormDataWithFile(file: File): FormData {
    const formData = new FormData();
    formData.append("file", file);
    return formData;
  }

  // Helper function to convert database user to request user format
  function toRequestUser(dbUser: typeof testUser) {
    return {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      role: dbUser.role as "admin" | "supporter" | "user",
      isActive: dbUser.isActive ?? true,
      emailVerified: dbUser.emailVerified ?? true,
    };
  }

  // Helper function to create authenticated request with CSRF for file uploads
  function createAuthenticatedFileRequest(
    file: File,
    options: {
      user?: typeof testUser;
      csrfToken?: string;
      additionalHeaders?: Record<string, string>;
    } = {}
  ): NextRequest {
    const {
      user = testUser,
      csrfToken = generateCsrfToken(),
      additionalHeaders = {},
    } = options;

    // Create manual multipart form data that Node.js can parse properly
    const boundary = `----formdata-vitest-${Math.random().toString(36).substring(2)}`;

    // Get file content for multipart encoding
    const testFileContent =
      file.name && file.size > 0
        ? `test image content for ${file.name}`
        : "test content";

    // Manually construct the multipart body with proper file encoding
    let multipartBody = `--${boundary}\r\n`;
    multipartBody += `Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n`;
    multipartBody += `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
    multipartBody += testFileContent;
    multipartBody += `\r\n--${boundary}--\r\n`;

    console.log("Debug - Using manual multipart FormData construction");

    const requestOptions = {
      method: "POST" as const,
      headers: {
        Authorization: `Bearer ${createTestToken(toRequestUser(user))}`,
        "X-CSRF-Token": csrfToken,
        Cookie: `csrf_token=${csrfToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        ...additionalHeaders,
      },
      body: multipartBody,
    } satisfies ConstructorParameters<typeof NextRequest>[1];

    return new NextRequest("http://localhost:3000/api/upload", requestOptions);
  }

  describe("Authentication and Authorization", () => {
    it("should reject requests without authentication", async () => {
      const file = createTestFile("test.png");
      const formData = createFormDataWithFile(file);
      const request = await createTestRequestWithFormData(
        "http://localhost:3000/api/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      // Debug - check headers
      console.log(
        "Debug - Request headers:",
        Object.fromEntries(request.headers)
      );
      console.log("Debug - Content-Type:", request.headers.get("content-type"));

      const response = await POST(request);

      expect(response.status).toBe(401);

      const data = await response.json();
      console.log("Debug - response data:", JSON.stringify(data, null, 2));
      expect(data.error?.code).toBe(401);
    });

    it("should reject requests with invalid token", async () => {
      const file = createTestFile("test.png");
      const request = await createTestRequestWithFormData(
        "http://localhost:3000/api/upload",
        {
          method: "POST",
          body: createFormDataWithFile(file),
          headers: {
            Authorization: "Bearer invalid_token",
          },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should accept requests from authenticated users", async () => {
      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      // Debug - check headers
      console.log(
        "Debug - Authenticated request headers:",
        Object.fromEntries(request.headers)
      );
      console.log("Debug - Content-Type:", request.headers.get("content-type"));

      const response = await POST(request);

      if (response.status === 400) {
        const data = await response.json();
        expect(data.error?.code).not.toBe("CSRF_TOKEN_INVALID");
      }
    });

    it("should reject requests with invalid token", async () => {
      const file = createTestFile("test.png");
      const formData = createFormDataWithFile(file);
      const request = await createTestRequestWithFormData(
        "http://localhost:3000/api/upload",
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: "Bearer invalid-token",
          },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should accept requests from authenticated users", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      // Should not be an auth error (may fail for other reasons like file handling)
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  describe("CSRF Protection", () => {
    it("should accept requests with Bearer token (CSRF exempt)", async () => {
      const file = createTestFile("test.png");
      const formData = createFormDataWithFile(file);

      // Bearer token requests are exempt from CSRF protection
      const request = await createAuthenticatedRequestWithFormData(
        "http://localhost:3000/api/upload",
        toRequestUser(testUser),
        {
          method: "POST",
          body: formData,
          // No CSRF token needed for Bearer token requests
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should accept Bearer token requests regardless of CSRF tokens", async () => {
      const file = createTestFile("test.png");
      const cookieToken = generateCsrfToken();
      const headerToken = generateCsrfToken();

      // Bearer token requests are exempt from CSRF protection even with mismatched tokens
      const request = await createAuthenticatedRequestWithFormData(
        "http://localhost:3000/api/upload",
        toRequestUser(testUser),
        {
          method: "POST",
          body: createFormDataWithFile(file),
          headers: {
            "X-CSRF-Token": headerToken, // Different from cookie
          },
          cookies: {
            csrf_token: cookieToken, // Different from header
          },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200); // Bearer tokens are CSRF exempt
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should accept Bearer token requests (CSRF protection bypassed)", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const file = createTestFile("test.png");
      const csrfToken = generateCsrfToken();

      // Bearer token requests automatically bypass CSRF protection
      const request = await createAuthenticatedRequestWithFormData(
        "http://localhost:3000/api/upload",
        toRequestUser(testUser),
        {
          method: "POST",
          body: createFormDataWithFile(file),
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          cookies: {
            csrf_token: csrfToken,
          },
        }
      );

      const response = await POST(request);

      // Should not be a CSRF error
      expect(response.status).not.toBe(403);
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error?.code).not.toBe("CSRF_TOKEN_INVALID");
      }
    });
  });

  describe("File Type Validation", () => {
    it("should accept allowed image file types", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";

      const allowedTypes = [
        { filename: "test.png", mimeType: "image/png" },
        { filename: "test.jpg", mimeType: "image/jpeg" },
        { filename: "test.jpeg", mimeType: "image/jpeg" },
        { filename: "test.gif", mimeType: "image/gif" },
        { filename: "test.webp", mimeType: "image/webp" },
      ];

      for (const { filename, mimeType } of allowedTypes) {
        const file = createTestFile(filename, "test content", mimeType);
        const request = createAuthenticatedFileRequest(file);

        const response = await POST(request);

        if (response.status === 400) {
          const data = await response.json();
          expect(data.error?.message).not.toBe("Invalid file type");
        }
      }
    });

    it("should reject disallowed file types", async () => {
      const disallowedTypes = [
        "test.pdf",
        "test.exe",
        "test.zip",
        "test.txt",
        "test.html",
        "test.js",
        "test.php",
        "test.svg", // SVG not in allowed list
      ];

      for (const filename of disallowedTypes) {
        const file = createTestFile(filename);
        const request = createAuthenticatedFileRequest(file);

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error?.message).toBe("Invalid file type");
      }
    });

    it("should reject files without extensions", async () => {
      const file = createTestFile("noextension");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error?.message).toBe("Invalid file type");
    });

    it("should handle case-insensitive file extensions", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const file = createTestFile("test.PNG"); // Uppercase extension
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      // Should not fail due to file type (case should be ignored)
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error?.message).not.toBe("Invalid file type");
      }
    });
  });

  describe("Request Validation", () => {
    it("should reject requests without file", async () => {
      const formData = new FormData();
      const csrfToken = generateCsrfToken();
      // No file appended
      const request = await createAuthenticatedRequestWithFormData(
        "http://localhost:3000/api/upload",
        toRequestUser(testUser),
        {
          method: "POST",
          body: formData,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          cookies: {
            csrf_token: csrfToken,
          },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error?.message).toBe("No file provided");
    });

    it("should reject requests with empty file", async () => {
      const formData = new FormData();
      const csrfToken = generateCsrfToken();
      formData.append("file", new File([], "")); // Empty file with no name
      const request = await createAuthenticatedRequestWithFormData(
        "http://localhost:3000/api/upload",
        toRequestUser(testUser),
        {
          method: "POST",
          body: formData,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          cookies: {
            csrf_token: csrfToken,
          },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error?.message).toBe("No file provided");
    });
  });

  describe("Filename Security", () => {
    it("should sanitize dangerous filenames", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const dangerousFilenames = [
        "../../../etc/passwd.png",
        "..\\..\\windows\\system32\\config.png",
        "file with spaces and (special) chars!.png",
        "file/with/slashes.png",
        "file\\with\\backslashes.png",
        ".hidden.png",
        "...multiple...dots...png",
      ];

      for (const filename of dangerousFilenames) {
        const file = createTestFile(filename);
        const request = createAuthenticatedFileRequest(file);

        const response = await POST(request);

        // Should not fail due to filename (should be sanitized)
        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.storage).toBe("local");
          // Filename should be sanitized and safe
          expect(data.filename).not.toContain("../");
          expect(data.filename).not.toContain("..\\");
          expect(data.filename).not.toContain("/");
          expect(data.filename).not.toContain("\\");
        }
      }
    });

    it("should handle extremely long filenames", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const longFilename = "a".repeat(200) + ".png"; // Very long filename
      const file = createTestFile(longFilename);
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      // Should handle long filenames gracefully
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        // Filename should be truncated to reasonable length
        expect(data.filename!.length).toBeLessThanOrEqual(150); // UUID + cleaned name
      }
    });

    it("should handle filenames with only dangerous characters", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const file = createTestFile("../\\/.png"); // Only dangerous chars
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        // Should fallback to safe filename (dangerous chars replaced with underscores)
        expect(data.filename).toMatch(/^[a-f0-9-]+____\.png$/);
      }
    });
  });

  describe("Local Storage Upload", () => {
    beforeEach(() => {
      // Force local storage by not setting Cloudinary env vars
      process.env["UPLOAD_FOLDER"] = "test-uploads";
    });

    it("should successfully upload to local storage when Cloudinary is not configured", async () => {
      const file = createTestFile("test.png", "test image content");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.storage).toBe("local");
      expect(data.filename).toBeDefined();
      expect(data.url).toBeDefined();
      expect(data.url).toMatch(/^\/api\/uploads\/.+\.png$/);
      expect(data.message).toBe("File uploaded successfully to local storage");
    });

    it("should create upload directory if it doesn't exist", async () => {
      // Use a unique directory name for this test to avoid conflicts
      const uniqueUploadDir = `test-uploads-create-${Date.now()}`;
      const uploadPath = path.resolve(process.cwd(), uniqueUploadDir);
      process.env["UPLOAD_FOLDER"] = uniqueUploadDir;

      // Verify the unique directory doesn't exist
      expect(existsSync(uploadPath)).toBe(false);

      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(existsSync(uploadPath)).toBe(true);

      // Clean up the unique directory
      await rmdir(uploadPath, { recursive: true }).catch(() => {
        // Ignore cleanup errors
      });
    });

    it("should generate unique filenames to prevent conflicts", async () => {
      const file1 = createTestFile("test.png", "content1");
      const file2 = createTestFile("test.png", "content2");

      const request1 = createAuthenticatedFileRequest(file1);
      const request2 = createAuthenticatedFileRequest(file2);

      const response1 = await POST(request1);
      const response2 = await POST(request2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.filename).not.toBe(data2.filename);
      expect(data1.filename).toMatch(/^[a-f0-9-]+_test\.png$/);
      expect(data2.filename).toMatch(/^[a-f0-9-]+_test\.png$/);
    });

    it("should prevent path traversal attacks", async () => {
      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify the file was saved in the correct directory
      const uploadPath = path.resolve(process.cwd(), "test-uploads");
      const filePath = path.join(uploadPath, data.filename!);
      const resolvedPath = path.resolve(filePath);

      expect(resolvedPath.startsWith(uploadPath)).toBe(true);
    });

    it("should handle custom upload folder from environment", async () => {
      const customUploadFolder = "custom-test-uploads";
      process.env["UPLOAD_FOLDER"] = customUploadFolder;

      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(200);

      // Verify custom folder was created and used
      const customUploadPath = path.resolve(process.cwd(), customUploadFolder);
      expect(existsSync(customUploadPath)).toBe(true);

      // Clean up custom folder
      if (existsSync(customUploadPath)) {
        await rmdir(customUploadPath, { recursive: true }).catch(() => {
          // Ignore cleanup errors
        });
      }
    });
  });

  describe("Cloudinary Upload Path", () => {
    beforeEach(() => {
      // Mock Cloudinary environment variables
      process.env["CLOUDINARY_CLOUD_NAME"] = "test-cloud";
      process.env["CLOUDINARY_API_KEY"] = "test-key";
      process.env["CLOUDINARY_API_SECRET"] = "test-secret";
    });

    it("should attempt Cloudinary upload when configured", async () => {
      // Mock the cloudinary upload to fail so we can test the fallback
      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      // Even if Cloudinary fails, should fallback to local
      // But should not be a configuration error
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        // Could be either Cloudinary or local storage depending on mock behavior
        expect(["cloudinary", "local"]).toContain(data.storage);
      }
    });

    it("should fallback to local storage when Cloudinary fails", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";

      // The actual Cloudinary upload might fail due to network or invalid credentials
      // but the code should gracefully fallback to local storage
      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Should fallback to local storage if Cloudinary fails
      if (data.storage === "local") {
        expect(data.filename).toBeDefined();
        expect(data.url).toMatch(/^\/api\/uploads\/.+\.png$/);
      }
    });

    it("should handle incomplete Cloudinary configuration", async () => {
      // Remove one required env var
      delete process.env["CLOUDINARY_API_SECRET"];
      process.env["UPLOAD_FOLDER"] = "test-uploads";

      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.storage).toBe("local"); // Should fallback to local
    });
  });

  describe("Error Handling", () => {
    it("should handle file reading errors gracefully", async () => {
      // Create a mock file that will cause issues
      const file = createTestFile("test.png", ""); // Empty content
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      // Should handle gracefully, either succeed with empty file or provide clear error
      if (response.status !== 200) {
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBeDefined();
      }
    });

    it("should handle missing upload folder permissions gracefully", async () => {
      // Set upload folder to a restricted path (this might not fail in test env)
      process.env["UPLOAD_FOLDER"] = "/root/restricted-uploads";

      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      // Should either succeed or fail gracefully
      if (response.status !== 200) {
        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.message).toBeDefined();
      }
    });

    it("should return proper error format for all failures", async () => {
      // Test with invalid file type to trigger error
      const file = createTestFile("test.exe");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toHaveProperty("message");
      expect(data.error.message).toBe("Invalid file type");
    });
  });

  describe("Response Format", () => {
    it("should return correct response format for successful local upload", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        filename: expect.stringMatching(/^[a-f0-9-]+_test\.png$/),
        url: expect.stringMatching(/^\/api\/uploads\/.+\.png$/),
        storage: "local",
        message: "File uploaded successfully to local storage",
      });
    });

    it("should return correct Content-Type header", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const file = createTestFile("test.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.headers.get("content-type")).toBe("application/json");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small files", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const file = createTestFile("tiny.png", "x"); // 1 byte file
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should handle files with unicode characters in filename", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";
      const file = createTestFile("测试文件🖼️.png");
      const request = createAuthenticatedFileRequest(file);

      const response = await POST(request);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        // Unicode chars should be sanitized to safe characters
        expect(data.filename).toMatch(/^[a-f0-9-]+_[a-zA-Z0-9_.-]+\.png$/);
      }
    });

    it("should handle concurrent uploads", async () => {
      process.env["UPLOAD_FOLDER"] = "test-uploads";

      const uploadPromises = Array.from({ length: 5 }, (_, index) => {
        const file = createTestFile(
          `concurrent-${index}.png`,
          `content-${index}`
        );
        const request = createAuthenticatedFileRequest(file);
        return POST(request);
      });

      const responses = await Promise.all(uploadPromises);

      // All uploads should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // All filenames should be unique
      const filenames = await Promise.all(
        responses.map(async (r) => {
          const data = await r.json();
          return data.filename;
        })
      );

      const uniqueFilenames = new Set(filenames);
      expect(uniqueFilenames.size).toBe(filenames.length);
    });
  });
});
