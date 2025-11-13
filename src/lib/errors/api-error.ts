/**
 * API Error Handling Utilities
 *
 * Provides consistent error handling across all API routes with:
 * - Standardized error response format
 * - Proper HTTP status codes
 * - Error code categorization
 * - Development vs production error details
 * - Logging integration
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

/**
 * Custom API Error class with status code and error code
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common API error types
 */
export class BadRequestError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Access forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

/**
 * Handle any error and return a consistent NextResponse
 *
 * @param error - The error to handle
 * @param context - Optional context for logging (e.g., endpoint name)
 * @returns NextResponse with standardized error format
 */
export function handleApiError(
  error: unknown,
  context?: string
): NextResponse<ErrorResponse> {
  // Log the error with context
  const logContext = context ? `[${context}]` : "[API]";
  logger.error(`${logContext} Error:`, error);

  // Handle known ApiError instances
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle Prisma errors (database errors)
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; meta?: unknown };

    // Common Prisma error codes
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        {
          error: {
            message: "A record with this information already exists",
            code: "DUPLICATE_RECORD",
            details:
              process.env.NODE_ENV === "development"
                ? prismaError.meta
                : undefined,
          },
        },
        { status: 409 }
      );
    }

    if (prismaError.code === "P2025") {
      return NextResponse.json(
        {
          error: {
            message: "Record not found",
            code: "NOT_FOUND",
          },
        },
        { status: 404 }
      );
    }

    if (prismaError.code === "P2003") {
      return NextResponse.json(
        {
          error: {
            message: "Referenced record not found",
            code: "FOREIGN_KEY_CONSTRAINT",
            details:
              process.env.NODE_ENV === "development"
                ? prismaError.meta
                : undefined,
          },
        },
        { status: 400 }
      );
    }
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    // Don't leak error details in production
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message;

    const details =
      process.env.NODE_ENV === "development"
        ? {
            name: error.name,
            stack: error.stack,
          }
        : undefined;

    return NextResponse.json(
      {
        error: {
          message,
          code: "INTERNAL_ERROR",
          details,
        },
      },
      { status: 500 }
    );
  }

  // Handle unknown error types
  return NextResponse.json(
    {
      error: {
        message: "An unexpected error occurred",
        code: "UNKNOWN_ERROR",
        details:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
    },
    { status: 500 }
  );
}

/**
 * Async error handler wrapper for API routes
 *
 * Usage:
 * export const GET = withErrorHandler(async (request) => {
 *   // Your route logic
 * }, 'GET /api/cards');
 */
export function withErrorHandler<
  T extends (...args: unknown[]) => Promise<NextResponse>,
>(handler: T, context?: string): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, context);
    }
  }) as T;
}

/**
 * Create a success response with consistent format
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  meta?: {
    page?: number;
    limit?: number;
    offset?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  }
): NextResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = { data }; // Using any for dynamic property assignment

  if (meta) {
    response.meta = meta;
  }

  return NextResponse.json(response, { status });
}
