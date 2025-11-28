import { describe, test, expect } from "vitest";
import crypto from "crypto";
import { generateSecureToken, hashToken } from "./tokens";

describe("Email token utilities", () => {
  describe("generateSecureToken", () => {
    test("should generate a token with default length", () => {
      const token = generateSecureToken();

      // Default length is 32 bytes, which becomes 64 hex characters
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should generate a token with custom length", () => {
      const token16 = generateSecureToken(16);
      expect(token16).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token16).toMatch(/^[a-f0-9]{32}$/);

      const token8 = generateSecureToken(8);
      expect(token8).toHaveLength(16); // 8 bytes = 16 hex chars
      expect(token8).toMatch(/^[a-f0-9]{16}$/);
    });

    test("should generate different tokens each time", () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
    });

    test("should handle edge cases", () => {
      const token1 = generateSecureToken(1);
      expect(token1).toHaveLength(2); // 1 byte = 2 hex chars

      const token64 = generateSecureToken(64);
      expect(token64).toHaveLength(128); // 64 bytes = 128 hex chars
    });

    test("should generate cryptographically random tokens", () => {
      // Generate many tokens and check for uniqueness
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken(16));
      }

      // Should have 100 unique tokens
      expect(tokens.size).toBe(100);
    });
  });

  describe("hashToken", () => {
    test("should hash a token consistently", () => {
      const token = "test-token-123";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should produce different hashes for different tokens", () => {
      const token1 = "test-token-1";
      const token2 = "test-token-2";

      const hash1 = hashToken(token1);
      const hash2 = hashToken(token2);

      expect(hash1).not.toBe(hash2);
    });

    test("should handle empty strings", () => {
      const hash = hashToken("");

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should handle special characters", () => {
      const token = "token@#$%^&*(){}[]|\\:;\"'<>,.?/~`+=_-";
      const hash = hashToken(token);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should produce expected SHA-256 hash", () => {
      const token = "hello world";
      const hash = hashToken(token);

      // Verify against known SHA-256 hash
      const expectedHash = crypto
        .createHash("sha256")
        .update("hello world")
        .digest("hex");
      expect(hash).toBe(expectedHash);
    });

    test("should handle long strings", () => {
      const longToken = "a".repeat(1000);
      const hash = hashToken(longToken);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should be case sensitive", () => {
      const hash1 = hashToken("Token");
      const hash2 = hashToken("token");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("integration tests", () => {
    test("should work together for token generation and hashing", () => {
      const token = generateSecureToken();
      const hash = hashToken(token);

      expect(token).toHaveLength(64);
      expect(hash).toHaveLength(64);
      expect(token).not.toBe(hash);
    });

    test("should generate unique hashes for unique tokens", () => {
      const tokens = [];
      const hashes = [];

      for (let i = 0; i < 10; i++) {
        const token = generateSecureToken();
        const hash = hashToken(token);
        tokens.push(token);
        hashes.push(hash);
      }

      // All tokens should be unique
      expect(new Set(tokens).size).toBe(10);

      // All hashes should be unique
      expect(new Set(hashes).size).toBe(10);
    });
  });
});
