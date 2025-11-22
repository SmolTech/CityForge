# Integration Testing with Testcontainers

This document describes the integration testing setup for CityForge using Testcontainers.

## Overview

Integration tests verify that different parts of the application work together correctly by:

- Testing API routes with a real PostgreSQL database
- Verifying database operations and data integrity
- Testing authentication flows end-to-end
- Ensuring proper error handling and validation

## Technology Stack

- **Testcontainers**: Spins up isolated PostgreSQL containers for each test suite
- **Vitest**: Test runner with native TypeScript support
- **Prisma**: Database ORM for schema management and queries
- **PostgreSQL 16**: Database engine running in Docker containers

## Setup and Installation

The required dependencies are already installed:

```json
{
  "devDependencies": {
    "testcontainers": "^10.x",
    "@testcontainers/postgresql": "^10.x"
  }
}
```

## Running Integration Tests

### Run All Integration Tests

```bash
npm run test:run -- tests/integration/
```

### Run Specific Test Suites

```bash
# Authentication tests
npm run test:run -- tests/integration/api/auth.test.ts

# Cards API tests
npm run test:run -- tests/integration/api/cards.test.ts
```

### Requirements

- **Docker**: Must be running and accessible
- **Port 5432**: Available for PostgreSQL (Testcontainers assigns random ports)
- **Disk Space**: ~200MB for PostgreSQL image (downloaded once)

## Architecture

### Test Container Lifecycle

1. **Before All Tests** (`beforeAll`):
   - Starts PostgreSQL container (postgres:16-alpine)
   - Applies Prisma schema via `npx prisma db push`
   - Creates Prisma client connected to test database
   - Clears any cached Prisma clients

2. **After Each Test** (`afterEach`):
   - Cleans all data from database tables
   - Ensures test isolation

3. **After All Tests** (`afterAll`):
   - Disconnects Prisma client
   - Stops and removes PostgreSQL container

### File Structure

```
tests/
├── integration/
│   ├── setup.ts                 # Testcontainers setup and utilities
│   ├── api/
│   │   ├── auth.test.ts        # Authentication API tests (9 tests - ✅ passing)
│   │   └── cards.test.ts       # Cards API tests (9 tests - ⚠️ 4/9 passing)
│   ├── components/
│   │   ├── business-directory.test.tsx
│   │   └── login.test.tsx
│   └── database/
│       └── core-operations.test.ts  # Skipped - needs update
└── utils/
    ├── api-test-helpers.ts     # API request mocking utilities
    ├── database-test-helpers.ts # Database seeding utilities
    └── component-test-helpers.tsx # React component test utilities
```

## Test Utilities

### Integration Setup (`tests/integration/setup.ts`)

```typescript
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
} from "../setup";

describe("My Integration Tests", () => {
  beforeAll(async () => {
    await setupIntegrationTests();
  }, 60000); // 60 second timeout for container startup

  afterEach(async () => {
    await cleanDatabase(); // Clean between tests
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  }, 30000);

  it("should test something", async () => {
    // Your test here
  });
});
```

### Database Helpers (`tests/utils/database-test-helpers.ts`)

```typescript
import {
  createTestUserInDb,
  createTestCardInDb,
  createUniqueTestUser,
  createUniqueTestAdmin,
} from "../../utils/database-test-helpers";

// Create a test user
const user = await createTestUserInDb({
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  password: "Password123!",
});

// Create a test card
const card = await createTestCardInDb({
  name: "Test Business",
  description: "A test business",
  tags: ["restaurant", "food"],
  userId: user.id,
});

// Create unique users to avoid conflicts
const uniqueUser = await createUniqueTestUser();
const uniqueAdmin = await createUniqueTestAdmin();
```

### API Test Helpers (`tests/utils/api-test-helpers.ts`)

```typescript
import {
  createTestRequest,
  createAuthenticatedRequest,
  assertApiResponse,
} from "../../utils/api-test-helpers";

// Create mock API request
const request = createTestRequest("http://localhost:3000/api/cards", {
  method: "GET",
});

// Create authenticated request
const authRequest = createAuthenticatedRequest(
  "http://localhost:3000/api/auth/me",
  user,
  { method: "GET" }
);

// Assert API response
await assertApiResponse(response, 200, (data) => {
  expect(data.cards).toBeDefined();
  expect(data.cards).toHaveLength(2);
});
```

## Test Status

### ✅ Passing Tests

**Authentication API (`tests/integration/api/auth.test.ts`)** - 9/9 tests passing:

- Login with valid credentials
- Login rejection (invalid credentials, inactive user, invalid email)
- Registration with valid data
- Registration rejection (duplicate email, missing fields, weak password)
- Logout functionality
- Cookie handling
- Token validation

### ⚠️ Partially Passing Tests

**Cards API (`tests/integration/api/cards.test.ts`)** - 4/9 tests passing:

- ✅ Pagination support
- ✅ 404 for non-existent card
- ✅ 400 for invalid card ID
- ✅ Reject unauthenticated edit suggestion
- ❌ Return list of approved cards (finds extra cards)
- ❌ Filter cards by tag (finds extra cards)
- ❌ Return card details (card not found)
- ❌ Create edit suggestion (authentication issue)
- ❌ Validate edit suggestion data (authentication issue)

**Known Issues**:

- Some cards tests are finding more data than expected, suggesting database cleanup timing issues
- Authentication for edit suggestions may need adjustment

### 📝 Skipped Tests

**Database Core Operations** - Skipped pending API method updates

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on data from previous tests:

```typescript
it("should create a user", async () => {
  // Use unique identifiers
  const uniqueEmail = `test-${Date.now()}@example.com`;
  const user = await createTestUserInDb({
    email: uniqueEmail,
    // ...
  });

  // Test logic
});
```

### 2. Cleanup

Always clean up after tests to ensure isolation:

```typescript
afterEach(async () => {
  await cleanDatabase(); // Removes all test data
});
```

### 3. Timeouts

Integration tests take longer than unit tests. Set appropriate timeouts:

```typescript
beforeAll(async () => {
  await setupIntegrationTests();
}, 60000); // 60 seconds for container startup
```

### 4. Unique Data

Use timestamps or random values to ensure unique test data:

```typescript
const uniqueEmail = `user-${Date.now()}@example.com`;
const uniqueName = `Business-${Math.random()}`;
```

## Troubleshooting

### Docker Not Running

**Error**: "Cannot connect to Docker daemon"

**Solution**: Ensure Docker Desktop is running:

```bash
docker ps  # Should list running containers
```

### Port Conflicts

**Error**: "Port 5432 already in use"

**Solution**: Testcontainers automatically assigns random ports. If issues persist:

```bash
docker ps  # Check for existing PostgreSQL containers
docker stop <container-id>  # Stop conflicting container
```

### Slow Test Startup

First run downloads the PostgreSQL image (~200MB). Subsequent runs are faster as the image is cached.

### Database Connection Issues

If tests fail to connect to the database:

1. Check Docker is running: `docker ps`
2. Check logs: `npm run test:run -- tests/integration/ --reporter=verbose`
3. Verify DATABASE_URL is set correctly in test output

### Prisma Client Caching

If tests use stale database connections:

```typescript
// The setup already clears cached clients
if (globalThis.__prisma) {
  await globalThis.__prisma.$disconnect();
  globalThis.__prisma = undefined;
}
```

## Performance

### Container Startup Time

- **First run**: ~15-20 seconds (downloading PostgreSQL image)
- **Subsequent runs**: ~5-10 seconds (image cached)

### Test Execution Time

- **Authentication tests** (9 tests): ~5 seconds
- **Cards tests** (9 tests): ~6 seconds
- **Total suite**: ~12 seconds (with container startup)

### Optimization Tips

1. **Run tests in parallel**: Vitest supports concurrent tests
2. **Reuse containers**: Use `setupIntegrationTestSuite()` helper (already implemented)
3. **Minimize database operations**: Use `createUnique*` helpers for faster setup

## Next Steps

1. **Fix Cards API Test Issues**:
   - Debug why some tests find extra cards
   - Fix authentication issues in edit suggestion tests

2. **Add More Integration Tests**:
   - Forum API tests
   - Resource directory tests
   - Review and rating tests
   - Admin operations tests

3. **End-to-End Testing**:
   - Implement Playwright for browser automation
   - Test complete user journeys
   - Verify frontend + backend integration

4. **Performance Testing**:
   - Load testing with k6 or Artillery
   - Test pagination with large datasets
   - Verify rate limiting behavior

## References

- [Testcontainers Documentation](https://node.testcontainers.org/)
- [Vitest Documentation](https://vitest.dev/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [CityForge Testing Improvements](./TESTING_IMPROVEMENTS.md)
