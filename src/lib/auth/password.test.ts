import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "./password";

describe("Password Utilities", () => {
  describe("hashPassword", () => {
    it("should hash a password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      expect(hash.startsWith("$2")).toBe(true); // bcrypt hashes start with $2
    });

    it("should create different hashes for the same password", async () => {
      const password = "TestPassword123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salt ensures different hashes
    });
  });

  describe("verifyPassword", () => {
    it("should verify a correct password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      const wrongPassword = "WrongPassword123!";

      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it("should reject empty password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword("", hash);

      expect(isValid).toBe(false);
    });
  });

  describe("validatePasswordStrength", () => {
    it("should accept a valid password", () => {
      const result = validatePasswordStrength("ValidPass123");

      expect(result.valid).toBe(true);
      expect(result.message).toBe("Password is valid");
    });

    it("should reject password that is too short", () => {
      const result = validatePasswordStrength("Short1A");

      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "Password must be at least 8 characters long"
      );
    });

    it("should reject password without lowercase letter", () => {
      const result = validatePasswordStrength("PASSWORD123");

      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "Password must contain at least one lowercase letter"
      );
    });

    it("should reject password without uppercase letter", () => {
      const result = validatePasswordStrength("password123");

      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "Password must contain at least one uppercase letter"
      );
    });

    it("should reject password without a number", () => {
      const result = validatePasswordStrength("PasswordOnly");

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Password must contain at least one number");
    });

    it("should accept password with special characters", () => {
      const result = validatePasswordStrength("ValidPass123!@#");

      expect(result.valid).toBe(true);
      expect(result.message).toBe("Password is valid");
    });

    it("should accept minimum valid password", () => {
      const result = validatePasswordStrength("Aa1aaaaa");

      expect(result.valid).toBe(true);
    });
  });
});
