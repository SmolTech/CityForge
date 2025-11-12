# Database Transaction Support

This document describes the transaction and retry utilities available for ensuring data consistency in multi-step database operations.

## Overview

The application provides three utility functions for handling database operations:

1. **`withTransaction`** - Execute operations in an atomic transaction
2. **`withRetry`** - Retry operations with exponential backoff on transient errors
3. **`withRetryAndTransaction`** - Combined transaction + retry for critical operations

## Usage

### Basic Transaction

Use `withTransaction` when you need to ensure multiple database operations complete atomically (all-or-nothing).

```typescript
import { withTransaction, prisma } from "@/lib/db";

async function createCardWithTags(cardData, tagIds) {
  return await withTransaction(async (tx) => {
    // Create card
    const card = await tx.card.create({
      data: cardData,
    });

    // Create tag associations
    await tx.cardTag.createMany({
      data: tagIds.map((tagId) => ({
        cardId: card.id,
        tagId,
      })),
    });

    return card;
  });
}
```

**Benefits:**

- If tag creation fails, card creation is rolled back
- No orphaned records
- Database remains consistent

### Retry Logic

Use `withRetry` to handle transient errors (connection issues, deadlocks).

```typescript
import { withRetry } from "@/lib/db";

async function fetchDataWithRetry() {
  return await withRetry(
    async () => {
      return await prisma.card.findMany();
    },
    {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      operationName: "Fetch cards",
    }
  );
}
```

**Retry Behavior:**

- Exponential backoff: 1s, 2s, 4s, 8s...
- Jitter (±10%) to prevent thundering herd
- Only retries on retryable errors (connection issues, deadlocks)
- Logs warnings for each retry attempt

### Combined Transaction + Retry

Use `withRetryAndTransaction` for critical operations that need both atomicity and resilience.

```typescript
import { withRetryAndTransaction } from "@/lib/db";

async function approveSubmission(submissionId, reviewerId) {
  return await withRetryAndTransaction(
    async (tx) => {
      // Get submission
      const submission = await tx.cardSubmission.findUnique({
        where: { id: submissionId },
      });

      // Create card from submission
      const card = await tx.card.create({
        data: {
          name: submission.name,
          description: submission.description,
          // ...other fields
        },
      });

      // Update submission status
      await tx.cardSubmission.update({
        where: { id: submissionId },
        data: {
          status: "approved",
          reviewedBy: reviewerId,
          cardId: card.id,
        },
      });

      return { card, submission };
    },
    {
      maxRetries: 3,
      transactionTimeout: 10000, // 10 seconds
      operationName: "Approve submission",
    }
  );
}
```

## Retryable Errors

The retry logic automatically detects and retries these error types:

### Prisma Errors

- **P1001**: Can't reach database server
- **P1008**: Operations timed out
- **P1017**: Server has closed the connection
- **P2034**: Transaction failed due to write conflict or deadlock

### Generic Errors

- Connection errors
- Timeout errors
- Deadlock errors

## Configuration Options

### `withTransaction` Options

```typescript
{
  maxWait?: number;    // Max time to wait for transaction to start (ms, default: 5000)
  timeout?: number;    // Max time transaction can run (ms, default: 10000)
}
```

### `withRetry` Options

```typescript
{
  maxRetries?: number;      // Maximum retry attempts (default: 3)
  baseDelay?: number;       // Base delay in ms (default: 1000)
  maxDelay?: number;        // Maximum delay in ms (default: 10000)
  operationName?: string;   // Name for logging (default: "Database operation")
}
```

### `withRetryAndTransaction` Options

```typescript
{
  maxRetries?: number;              // Retry attempts (default: 3)
  baseDelay?: number;               // Base delay (default: 1000ms)
  maxDelay?: number;                // Max delay (default: 10000ms)
  transactionTimeout?: number;      // Transaction timeout (default: 10000ms)
  transactionMaxWait?: number;      // Max wait for transaction start (default: 5000ms)
  operationName?: string;           // Operation name for logging
}
```

## Best Practices

### 1. Use Transactions for Multi-Step Operations

**✅ Good** - Atomic operation:

```typescript
await withTransaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.profile.create({ data: { userId: user.id, ...profileData } });
});
```

**❌ Bad** - Non-atomic, can leave orphaned user:

```typescript
const user = await prisma.user.create({ data: userData });
await prisma.profile.create({ data: { userId: user.id, ...profileData } });
```

### 2. Keep Transactions Short

**✅ Good** - Quick database operations only:

```typescript
await withTransaction(async (tx) => {
  const card = await tx.card.update({ where: { id }, data });
  await tx.cardTag.createMany({ data: tags });
});
```

**❌ Bad** - Slow external API calls in transaction:

```typescript
await withTransaction(async (tx) => {
  const card = await tx.card.create({ data });
  await sendEmailNotification(card); // DON'T DO THIS!
});
```

### 3. Use Nested Writes When Possible

Prisma's nested writes are simpler and automatic transactions:

**✅ Preferred** - Single operation with nested write:

```typescript
await prisma.card.create({
  data: {
    ...cardData,
    card_tags: {
      create: tagIds.map((tagId) => ({ tagId })),
    },
  },
});
```

**⚠️ Alternative** - Manual transaction:

```typescript
await withTransaction(async (tx) => {
  const card = await tx.card.create({ data: cardData });
  await tx.cardTag.createMany({
    data: tagIds.map((tagId) => ({ cardId: card.id, tagId })),
  });
});
```

### 4. Only Retry Critical Operations

**✅ Good** - Retry important operations:

```typescript
await withRetry(() => createPayment(data), {
  operationName: "Create payment",
});
```

**❌ Bad** - Don't retry non-critical reads:

```typescript
// Overkill for a simple read
await withRetry(() => prisma.card.findMany());
```

### 5. Set Appropriate Timeouts

```typescript
// Short timeout for quick operations
await withTransaction(
  async (tx) => {
    await tx.card.update({ where: { id }, data });
  },
  { timeout: 2000 }
);

// Longer timeout for complex operations
await withTransaction(
  async (tx) => {
    await tx.card.createMany({ data: manyCards });
  },
  { timeout: 30000 }
);
```

## Testing

See `src/lib/db/client.test.ts` for comprehensive test examples.

## Error Handling

All transaction/retry functions throw errors that should be caught:

```typescript
try {
  await withRetryAndTransaction(
    async (tx) => {
      // ... operations
    },
    { operationName: "Critical operation" }
  );
} catch (error) {
  logger.error("Operation failed:", error);
  // Handle error appropriately
}
```

## Logging

All retry attempts and transaction failures are automatically logged:

- **Retry warnings**: When operations are retried
- **Final errors**: When operations fail after all retries
- **Transaction failures**: When transactions roll back

Check logs for patterns of failures to identify underlying issues.

## Migration Guide

### Before (No Transaction Support)

```typescript
export async function createCardWithTags(data) {
  const card = await prisma.card.create({ data: cardData });
  await prisma.cardTag.createMany({
    data: data.tags.map((tagId) => ({ cardId: card.id, tagId })),
  });
  return card;
}
```

**Problem**: If tag creation fails, card is orphaned.

### After (With Transaction)

```typescript
import { withTransaction } from "@/lib/db";

export async function createCardWithTags(data) {
  return await withTransaction(async (tx) => {
    const card = await tx.card.create({ data: cardData });
    await tx.cardTag.createMany({
      data: data.tags.map((tagId) => ({ cardId: card.id, tagId })),
    });
    return card;
  });
}
```

**Solution**: Either both operations succeed, or both are rolled back.

## Related Files

- `src/lib/db/client.ts` - Implementation
- `src/lib/db/client.test.ts` - Tests
- `src/lib/db/index.ts` - Exports
