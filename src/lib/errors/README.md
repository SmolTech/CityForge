# API Error Handling

Consistent error handling utilities for Next.js API routes.

## Features

- ✅ Standardized error response format across all API routes
- ✅ HTTP status code consistency
- ✅ Typed error classes for common scenarios
- ✅ Prisma error handling (database errors)
- ✅ Production-safe error messages (no sensitive data leaks)
- ✅ Integrated logging
- ✅ TypeScript support
- ✅ Comprehensive test coverage (20 tests)

## Error Response Format

All errors follow this consistent format:

```json
{
  "error": {
    "message": "User-friendly error message",
    "code": "ERROR_CODE",
    "details": {} // Optional, only in development
  }
}
```

## Usage

### Basic Error Handling

```typescript
import { handleApiError, NotFoundError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const card = await prisma.card.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ data: card });
  } catch (error) {
    return handleApiError(error, "GET /api/cards/[id]");
  }
}
```

### Using Error Classes

```typescript
import {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getSession(request);
    if (!userId) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    if (!body.name) {
      throw new BadRequestError("Name is required");
    }

    const card = await prisma.card.findUnique({ where: { id: body.id } });
    if (!card) {
      throw new NotFoundError("Card");
    }

    // ...
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Using withErrorHandler Wrapper

```typescript
import { withErrorHandler, NotFoundError } from "@/lib/errors";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const card = await prisma.card.findUnique({ where: { id } });
  if (!card) {
    throw new NotFoundError("Card");
  }
  return NextResponse.json({ data: card });
}, "GET /api/cards/[id]");
```

### Success Responses

```typescript
import { successResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const cards = await prisma.card.findMany();

  return successResponse(cards, 200, {
    total: cards.length,
    page: 1,
    limit: 20,
  });
}
```

## Available Error Classes

| Class               | Status Code | Error Code          | Use Case                 |
| ------------------- | ----------- | ------------------- | ------------------------ |
| `ApiError`          | 500         | INTERNAL_ERROR      | Base error class         |
| `BadRequestError`   | 400         | BAD_REQUEST         | Invalid request data     |
| `UnauthorizedError` | 401         | UNAUTHORIZED        | Authentication required  |
| `ForbiddenError`    | 403         | FORBIDDEN           | Insufficient permissions |
| `NotFoundError`     | 404         | NOT_FOUND           | Resource not found       |
| `ConflictError`     | 409         | CONFLICT            | Resource already exists  |
| `ValidationError`   | 422         | VALIDATION_ERROR    | Validation failed        |
| `RateLimitError`    | 429         | RATE_LIMIT_EXCEEDED | Too many requests        |

## Prisma Error Handling

The error handler automatically converts Prisma errors:

| Prisma Code | HTTP Status | Error Code             | Description                   |
| ----------- | ----------- | ---------------------- | ----------------------------- |
| P2002       | 409         | DUPLICATE_RECORD       | Unique constraint violation   |
| P2025       | 404         | NOT_FOUND              | Record not found              |
| P2003       | 400         | FOREIGN_KEY_CONSTRAINT | Foreign key constraint failed |

## Development vs Production

**Development**:

- Detailed error messages
- Stack traces included
- Prisma metadata exposed

**Production**:

- Generic error messages
- No stack traces
- Sensitive data hidden

## Migration Guide

### Before (Inconsistent)

```typescript
// Different error formats
return NextResponse.json({ error: "Not found" }, { status: 404 });
return new Response("Not found", { status: 404 });
return NextResponse.json({ message: "Error occurred" }, { status: 500 });
```

### After (Consistent)

```typescript
import { handleApiError, NotFoundError } from "@/lib/errors";

try {
  // Your logic
} catch (error) {
  return handleApiError(error);
}

// Or throw typed errors
throw new NotFoundError("Card");
```

## Testing

```bash
npm test -- src/lib/errors/api-error.test.ts
```

20 tests covering:

- Error class creation
- Error handling
- Prisma error conversion
- Production vs development behavior
- Success responses
