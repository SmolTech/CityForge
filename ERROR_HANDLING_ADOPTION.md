# Error Handling Framework Adoption Plan

## Status: In Progress (1/54 routes updated)

## Overview

Systematically updating all 54 API routes to use the new consistent error handling framework defined in `src/lib/errors/`.

## Completed Routes ✅

### Authentication Routes (1/4)

- [x] `/api/auth/login` - Updated with ValidationError and UnauthorizedError

### Remaining Routes (53)

#### Authentication Routes (3)

- [ ] `/api/auth/register`
- [ ] `/api/auth/logout`
- [ ] `/api/auth/me`

#### Cards Routes (4)

- [ ] `/api/cards` (GET/POST)
- [ ] `/api/cards/[id]` (GET/PUT/DELETE)
- [ ] `/api/cards/[id]/reviews` (GET/POST)
- [ ] `/api/cards/[id]/suggest-edit` (POST)

#### Admin Routes (16)

- [ ] `/api/admin/tags` (GET/POST/PUT/DELETE)
- [ ] `/api/admin/users` (GET)
- [ ] `/api/admin/resources/config` (GET/POST/PUT)
- [ ] `/api/admin/forums/categories` (GET/POST/PUT/DELETE)
- [ ] `/api/admin/forums/category-requests` (GET/POST)
- [ ] `/api/admin/forums/reports` (GET/POST)
- [ ] `/api/admin/forums/threads` (GET/DELETE/POST)

#### Forum Routes (10)

- [ ] `/api/forums/categories` (GET)
- [ ] `/api/forums/categories/[slug]` (GET)
- [ ] `/api/forums/categories/[slug]/threads` (GET/POST)
- [ ] `/api/forums/categories/[slug]/threads/[id]` (GET/PUT/DELETE)
- [ ] `/api/forums/categories/[slug]/threads/[id]/posts` (GET/POST)
- [ ] `/api/forums/category-requests` (POST)
- [ ] `/api/forums/my` (GET)
- [ ] `/api/forums/reports` (POST)

#### Resource Routes (5)

- [ ] `/api/resources` (GET)
- [ ] `/api/resources/categories` (GET)
- [ ] `/api/resources/config` (GET)
- [ ] `/api/resources/items` (GET)
- [ ] `/api/resources/quick-access` (GET)

#### Business & Submission Routes (4)

- [ ] `/api/business/[...slug]` (GET)
- [ ] `/api/business/[id]/[[...slug]]` (GET)
- [ ] `/api/submissions` (GET/POST)
- [ ] `/api/upload` (POST)

#### Search & Utility Routes (11)

- [ ] `/api/search` (GET)
- [ ] `/api/tags` (GET)
- [ ] `/api/reviews/[id]` (GET/PUT/DELETE)
- [ ] `/api/reviews/[id]/report` (POST)
- [ ] `/api/health` (GET)
- [ ] `/api/config` (GET)
- [ ] `/api/uploads/[filename]` (GET)
- [ ] Various test/debug routes

## Migration Pattern

### Before (Inconsistent)

```typescript
export async function POST(request: NextRequest) {
  try {
    // Logic
  } catch (error) {
    logger.error("Error:", error);
    return NextResponse.json({ message: "Error occurred" }, { status: 500 });
  }
}
```

### After (Consistent)

```typescript
import { handleApiError, ValidationError, NotFoundError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    // Validation
    if (!validation.valid) {
      throw new ValidationError("Validation failed", validation.errors);
    }

    // Not found check
    if (!resource) {
      throw new NotFoundError("Resource");
    }

    // Logic
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, "POST /api/endpoint");
  }
}
```

## Common Patterns to Update

### 1. Validation Errors

**Before:**

```typescript
if (!validation.valid) {
  return NextResponse.json(
    { message: "Validation failed", errors: validation.errors },
    { status: 400 }
  );
}
```

**After:**

```typescript
if (!validation.valid) {
  throw new ValidationError("Validation failed", validation.errors);
}
```

### 2. Not Found Errors

**Before:**

```typescript
if (!card) {
  return NextResponse.json({ error: "Card not found" }, { status: 404 });
}
```

**After:**

```typescript
if (!card) {
  throw new NotFoundError("Card");
}
```

### 3. Unauthorized Errors

**Before:**

```typescript
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**After:**

```typescript
if (!userId) {
  throw new UnauthorizedError();
}
```

### 4. Forbidden Errors

**Before:**

```typescript
if (user.role !== "admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**After:**

```typescript
if (user.role !== "admin") {
  throw new ForbiddenError();
}
```

### 5. Generic Error Handler

**Before:**

```typescript
} catch (error) {
  logger.error("Error:", error);
  return NextResponse.json({ message: "Error" }, { status: 500 });
}
```

**After:**

```typescript
} catch (error) {
  return handleApiError(error, "METHOD /api/route");
}
```

## Benefits of Adoption

1. **Consistent Format**: All errors follow `{ error: { message, code, details } }`
2. **Better Debugging**: Error codes help identify issues
3. **User-Friendly**: Clear error messages
4. **Type-Safe**: TypeScript support
5. **Automatic Prisma Handling**: Database errors converted automatically
6. **Production-Safe**: Sensitive data never leaked

## Next Steps

1. Update authentication routes (register, logout, me)
2. Update card routes (main API surface)
3. Update admin routes (critical functionality)
4. Update forum routes
5. Update remaining utility routes
6. Test each batch thoroughly
7. Deploy incrementally

## Testing Strategy

After each batch of updates:

```bash
npm test
npm run typecheck
npm run build
```

Verify error responses match expected format:

```json
{
  "error": {
    "message": "User-friendly message",
    "code": "ERROR_CODE",
    "details": {} // Optional, development only
  }
}
```

## Notes

- Routes using `withAuth` middleware already have some error handling
- Prisma errors (P2002, P2025, P2003) are auto-converted
- Development vs production error details handled automatically
- All errors logged with context automatically
