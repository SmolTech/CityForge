import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock PrismaClient before importing - use factory function
vi.mock("@prisma/client", () => {
  const mockTransaction = vi.fn();
  const mockConnect = vi.fn();
  const mockQueryRaw = vi.fn();

  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      $transaction: mockTransaction,
      $connect: mockConnect,
      $queryRaw: mockQueryRaw,
    })),
    // Export mocks so we can access them in tests
    __mocks: {
      mockTransaction,
      mockConnect,
      mockQueryRaw,
    },
  };
});

// Mock logger
vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import {
  connectToDatabase,
  checkDatabaseHealth,
  withTransaction,
  withRetry,
  withRetryAndTransaction,
} from "./client";

// Get mock references
const { __mocks } = (await import("@prisma/client")) as {
  __mocks: {
    mockTransaction: ReturnType<typeof vi.fn>;
    mockConnect: ReturnType<typeof vi.fn>;
    mockQueryRaw: ReturnType<typeof vi.fn>;
  };
};
const { mockTransaction, mockConnect, mockQueryRaw } = __mocks;

describe("Database Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("connectToDatabase", () => {
    it("should return true on successful connection", async () => {
      mockConnect.mockResolvedValue(undefined);

      const result = await connectToDatabase();

      expect(result).toBe(true);
      expect(mockConnect).toHaveBeenCalledOnce();
    });

    it("should return false on connection failure", async () => {
      mockConnect.mockRejectedValue(new Error("Connection failed"));

      const result = await connectToDatabase();

      expect(result).toBe(false);
    });
  });

  describe("checkDatabaseHealth", () => {
    it("should return healthy status when query succeeds", async () => {
      mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);

      const result = await checkDatabaseHealth();

      expect(result.status).toBe("healthy");
      expect(result.timestamp).toBeDefined();
    });

    it("should return unhealthy status when query fails", async () => {
      mockQueryRaw.mockRejectedValue(new Error("Query failed"));

      const result = await checkDatabaseHealth();

      expect(result.status).toBe("unhealthy");
      expect(result.error).toBe("Query failed");
    });
  });

  describe("withTransaction", () => {
    it("should execute transaction successfully", async () => {
      const mockTx = { card: { create: vi.fn() } };
      mockTransaction.mockImplementation((cb) => cb(mockTx));

      const callback = vi.fn().mockResolvedValue("result");
      const result = await withTransaction(callback);

      expect(result).toBe("result");
      expect(callback).toHaveBeenCalledWith(mockTx);
    });

    it("should handle transaction errors", async () => {
      const error = new Error("Transaction failed");
      mockTransaction.mockRejectedValue(error);

      const callback = vi.fn();

      await expect(withTransaction(callback)).rejects.toThrow(
        "Transaction failed"
      );
    });

    it("should pass transaction options", async () => {
      mockTransaction.mockImplementation((cb) => cb({}));

      const callback = vi.fn().mockResolvedValue("result");
      await withTransaction(callback, {
        maxWait: 3000,
        timeout: 5000,
      });

      expect(mockTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxWait: 3000,
          timeout: 5000,
        })
      );
    });
  });

  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ code: "P1001" }) // Retryable
        .mockRejectedValueOnce({ code: "P2034" }) // Retryable
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        baseDelay: 10,
        maxRetries: 3,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-retryable errors", async () => {
      const operation = vi.fn().mockRejectedValue({ code: "P2002" });

      await expect(withRetry(operation)).rejects.toEqual({ code: "P2002" });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries", async () => {
      const operation = vi.fn().mockRejectedValue({ code: "P1001" });

      await expect(
        withRetry(operation, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toEqual({ code: "P1001" });

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should use exponential backoff", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ code: "P1001" })
        .mockRejectedValueOnce({ code: "P1001" })
        .mockResolvedValue("success");

      const startTime = Date.now();
      await withRetry(operation, {
        baseDelay: 100,
        maxRetries: 3,
      });
      const duration = Date.now() - startTime;

      // Should take at least 100ms + 200ms = 300ms (with jitter it might vary)
      expect(duration).toBeGreaterThanOrEqual(250);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should retry on connection errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection timeout"))
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        baseDelay: 10,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe("withRetryAndTransaction", () => {
    it("should combine retry and transaction logic", async () => {
      const mockTx = { card: { create: vi.fn() } };

      // First call fails with retryable error, second succeeds
      mockTransaction
        .mockRejectedValueOnce({ code: "P1001" })
        .mockImplementation((cb) => cb(mockTx));

      const callback = vi.fn().mockResolvedValue("success");

      const result = await withRetryAndTransaction(callback, {
        baseDelay: 10,
        maxRetries: 3,
      });

      expect(result).toBe("success");
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it("should throw after max retries", async () => {
      mockTransaction.mockRejectedValue({ code: "P1001" });

      const callback = vi.fn();

      await expect(
        withRetryAndTransaction(callback, {
          maxRetries: 2,
          baseDelay: 10,
        })
      ).rejects.toEqual({ code: "P1001" });

      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it("should pass transaction timeout options", async () => {
      mockTransaction.mockImplementation((cb) => cb({}));

      const callback = vi.fn().mockResolvedValue("result");
      await withRetryAndTransaction(callback, {
        transactionTimeout: 5000,
        transactionMaxWait: 3000,
        baseDelay: 10,
      });

      expect(mockTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          timeout: 5000,
          maxWait: 3000,
        })
      );
    });
  });
});
