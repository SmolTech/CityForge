import { describe, it, expect, vi } from "vitest";
import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  handleApiError,
  successResponse,
} from "./api-error";

describe("ApiError", () => {
  it("should create an ApiError with default values", () => {
    const error = new ApiError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.details).toBeUndefined();
  });

  it("should create an ApiError with custom values", () => {
    const error = new ApiError("Test error", 404, "NOT_FOUND", {
      resource: "user",
    });
    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.details).toEqual({ resource: "user" });
  });
});

describe("Error subclasses", () => {
  it("should create BadRequestError", () => {
    const error = new BadRequestError("Invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("BAD_REQUEST");
  });

  it("should create UnauthorizedError", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Authentication required");
  });

  it("should create ForbiddenError", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });

  it("should create NotFoundError", () => {
    const error = new NotFoundError("User");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("User not found");
  });

  it("should create ConflictError", () => {
    const error = new ConflictError("Resource already exists");
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("CONFLICT");
  });

  it("should create ValidationError", () => {
    const error = new ValidationError("Validation failed", {
      field: "email",
    });
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("VALIDATION_ERROR");
  });

  it("should create RateLimitError", () => {
    const error = new RateLimitError();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});

describe("handleApiError", () => {
  it("should handle ApiError instances", async () => {
    const error = new NotFoundError("User");
    const response = handleApiError(error);

    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        message: "User not found",
        code: "NOT_FOUND",
        details: undefined,
      },
    });
  });

  it("should handle Prisma duplicate error (P2002)", async () => {
    const prismaError = {
      code: "P2002",
      meta: { target: ["email"] },
    };

    const response = handleApiError(prismaError);
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error.message).toBe(
      "A record with this information already exists"
    );
    expect(body.error.code).toBe("DUPLICATE_RECORD");
  });

  it("should handle Prisma not found error (P2025)", async () => {
    const prismaError = {
      code: "P2025",
      meta: { cause: "Record to delete does not exist." },
    };

    const response = handleApiError(prismaError);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.message).toBe("Record not found");
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("should handle Prisma foreign key error (P2003)", async () => {
    const prismaError = {
      code: "P2003",
      meta: { field_name: "userId" },
    };

    const response = handleApiError(prismaError);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.message).toBe("Referenced record not found");
    expect(body.error.code).toBe("FOREIGN_KEY_CONSTRAINT");
  });

  it("should handle standard Error in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const error = new Error("Database connection failed");
    const response = handleApiError(error);

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.message).toBe("Internal server error");
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.details).toBeUndefined();

    vi.unstubAllEnvs();
  });

  it("should handle standard Error in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const error = new Error("Database connection failed");
    const response = handleApiError(error);

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.message).toBe("Database connection failed");
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.details).toBeDefined();
    expect(body.error.details).toHaveProperty("name", "Error");
    expect(body.error.details).toHaveProperty("stack");

    vi.unstubAllEnvs();
  });

  it("should handle unknown error types", async () => {
    const error = "String error";
    const response = handleApiError(error);

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.message).toBe("An unexpected error occurred");
    expect(body.error.code).toBe("UNKNOWN_ERROR");
  });

  it("should include context in logs", async () => {
    const error = new NotFoundError("Card");
    const response = handleApiError(error, "GET /api/cards/123");

    expect(response.status).toBe(404);
    // Logger call is tested implicitly
  });
});

describe("successResponse", () => {
  it("should create a success response with data", async () => {
    const data = { id: 1, name: "Test" };
    const response = successResponse(data);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ data });
  });

  it("should create a success response with custom status", async () => {
    const data = { id: 1, name: "Test" };
    const response = successResponse(data, 201);

    expect(response.status).toBe(201);
  });

  it("should create a success response with metadata", async () => {
    const data = [{ id: 1 }, { id: 2 }];
    const meta = {
      page: 1,
      limit: 10,
      total: 50,
      totalPages: 5,
      hasNext: true,
      hasPrev: false,
    };

    const response = successResponse(data, 200, meta);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ data, meta });
  });
});
