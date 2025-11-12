/**
 * Test suite for log redaction functionality
 *
 * This file tests the redaction utility to ensure sensitive data is properly
 * protected in application logs. Critical security tests for GitHub Issue #60.
 */

import { describe, it, expect } from "vitest";
import {
  redactDatabaseUrl,
  redactSensitiveData,
  redactValue,
  redactLogArguments,
} from "@/lib/utils/log-redaction";

// Test data with various sensitive patterns
const TEST_CASES = {
  databaseUrls: [
    "postgresql://user:password123@localhost:5432/mydb",
    "mysql://admin:secret@db.example.com:3306/app",
    "mongodb://username:p@ssw0rd@cluster.example.com:27017/database",
    "malformed-db:secret@host",
  ],

  passwords: [
    'password: "mypassword123"',
    "password=secret123",
    "pwd: supersecret",
    'passwd="admin123"',
  ],

  apiKeys: [
    "api_key: sk-1234567890abcdef",
    'secret_key="abc123xyz789"',
    "access_key: AKIAIOSFODNN7EXAMPLE",
  ],

  // Test tokens for JWT redaction validation
  // These are intentionally test data designed to test our security redaction
  tokens: [
    // nosemgrep: generic.secrets.security.detected-jwt-token.detected-jwt-token
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    // nosemgrep: generic.secrets.security.detected-jwt-token.detected-jwt-token
    "token: eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTcwNjIwMzMzNCwiaWF0IjoxNzA2MjAzMzM0fQ.Qg7b8Yl8iU8x7QZ9lKjNm2Pq3Rs4Tv5Uw6Xy7Za8Bc",
    // nosemgrep: generic.secrets.security.detected-jwt-token.detected-jwt-token
    'jwt="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiIiLCJhdWQiOiIiLCJpYXQiOjE3MDYyMDMzMzQsImV4cCI6MTcwNjIwMzMzNH0.test"',
  ],

  creditCards: [
    "4532 1234 5678 9012",
    "4532-1234-5678-9012",
    "4532123456789012",
  ],

  ssns: ["123-45-6789", "987-65-4321"],

  emails: [
    "user@example.com",
    "admin@company.org",
    "test.email+tag@domain.co.uk",
  ],

  sessionIds: [
    "session_id: abcdef123456789",
    'sessionid="xyz987654321abc"',
    "sess: 1a2b3c4d5e6f7g8h",
  ],
};

describe("Log Redaction Security Tests", () => {
  describe("Database URL Redaction", () => {
    it("should redact all database URLs with credentials", () => {
      TEST_CASES.databaseUrls.forEach((url) => {
        const redacted = redactDatabaseUrl(url);
        expect(redacted).toContain("***REDACTED***");
        expect(redacted).not.toContain("password");
        expect(redacted).not.toContain("secret");
        expect(redacted).not.toContain("p@ssw0rd");
      });
    });

    it("should preserve database type and host information", () => {
      const url = "postgresql://user:password123@localhost:5432/mydb";
      const redacted = redactDatabaseUrl(url);
      expect(redacted).toContain("postgresql://");
      expect(redacted).toContain("localhost");
      expect(redacted).toContain("5432");
    });
  });

  describe("Password Redaction", () => {
    it("should redact all password patterns", () => {
      TEST_CASES.passwords.forEach((input) => {
        const redacted = redactSensitiveData(input);
        expect(redacted).toContain("***REDACTED***");
        expect(redacted).not.toContain("mypassword123");
        expect(redacted).not.toContain("secret123");
        expect(redacted).not.toContain("supersecret");
        expect(redacted).not.toContain("admin123");
      });
    });
  });

  describe("API Key Redaction", () => {
    it("should redact all API key patterns", () => {
      TEST_CASES.apiKeys.forEach((input) => {
        const redacted = redactSensitiveData(input);
        expect(redacted).toContain("***REDACTED***");
        expect(redacted).not.toContain("sk-1234567890abcdef");
        expect(redacted).not.toContain("abc123xyz789");
        expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
      });
    });
  });

  describe("JWT Token Redaction", () => {
    it("should redact all JWT tokens", () => {
      TEST_CASES.tokens.forEach((input) => {
        const redacted = redactSensitiveData(input);
        expect(redacted).toContain("***REDACTED***");
        expect(redacted).not.toMatch(
          /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
        );
      });
    });

    it("should handle Bearer token format", () => {
      const bearerToken = TEST_CASES.tokens[0];
      const redacted = redactSensitiveData(bearerToken!);
      expect(redacted).toContain("Bearer ***REDACTED***");
    });
  });

  describe("Credit Card Redaction", () => {
    it("should redact all credit card numbers", () => {
      TEST_CASES.creditCards.forEach((input) => {
        const redacted = redactSensitiveData(input);
        expect(redacted).toBe("****-****-****-****");
      });
    });
  });

  describe("SSN Redaction", () => {
    it("should redact all SSN patterns", () => {
      TEST_CASES.ssns.forEach((input) => {
        const redacted = redactSensitiveData(input);
        expect(redacted).toBe("***-**-****");
      });
    });
  });

  describe("Email Redaction by Environment", () => {
    it("should redact emails in production environment", () => {
      TEST_CASES.emails.forEach((input) => {
        const redacted = redactSensitiveData(input, {
          environment: "production",
        });
        expect(redacted).toBe("***EMAIL_REDACTED***");
      });
    });

    it("should preserve emails in development environment", () => {
      TEST_CASES.emails.forEach((input) => {
        const redacted = redactSensitiveData(input, {
          environment: "development",
        });
        expect(redacted).toBe(input);
      });
    });
  });

  describe("Session ID Redaction", () => {
    it("should redact all session ID patterns", () => {
      TEST_CASES.sessionIds.forEach((input) => {
        const redacted = redactSensitiveData(input);
        expect(redacted).toContain("***REDACTED***");
        expect(redacted).not.toContain("abcdef123456789");
        expect(redacted).not.toContain("xyz987654321abc");
        expect(redacted).not.toContain("1a2b3c4d5e6f7g8h");
      });
    });
  });

  describe("Object Value Redaction", () => {
    it("should redact sensitive fields in objects", () => {
      const testObject = {
        username: "john_doe",
        password: "secret123",
        email: "john@example.com",
        api_key: "sk-abcd1234efgh5678",
        normalField: "safe_value",
        nested: {
          token: "bearer_token_123",
          publicData: "visible",
        },
      };

      const redactedObject = redactValue(testObject, {
        environment: "production",
      }) as typeof testObject;

      // Check sensitive fields are redacted
      expect(redactedObject.password).toBe("***REDACTED***");
      expect(redactedObject.api_key).toBe("***REDACTED***");
      expect(redactedObject.email).toBe("***EMAIL_REDACTED***");
      expect(redactedObject.nested.token).toBe("***REDACTED***");

      // Check safe fields are preserved
      expect(redactedObject.username).toBe("john_doe");
      expect(redactedObject.normalField).toBe("safe_value");
      expect(redactedObject.nested.publicData).toBe("visible");
    });
  });

  describe("Log Arguments Redaction", () => {
    it("should redact sensitive data in log arguments array", () => {
      const logArgs = [
        "User login attempt",
        { username: "test@example.com", password: "secret123" },
        "Error connecting to postgresql://user:pass@localhost:5432/db",
      ];

      const redactedArgs = redactLogArguments(logArgs, {
        environment: "production",
      }) as [string, Record<string, string>, string];

      // Check string message preserved
      expect(redactedArgs[0]).toBe("User login attempt");

      // Check object has sensitive fields redacted
      expect(redactedArgs[1]).toEqual({
        username: "***EMAIL_REDACTED***",
        password: "***REDACTED***",
      });

      // Check database URL redacted
      expect(redactedArgs[2]).toContain("***REDACTED***");
      expect(redactedArgs[2]).not.toContain("pass");
    });
  });

  describe("Security Regression Prevention", () => {
    it("should never leak actual sensitive values", () => {
      const sensitiveInputs = [
        "postgresql://admin:topsecret123@db.company.com:5432/production",
        // nosemgrep: generic.secrets.security.detected-jwt-token.detected-jwt-token
        "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.realtoken.signature",
        "api_key: sk-live-realkey123456789abcdef",
        "password: MyRealPassword123!",
      ];

      sensitiveInputs.forEach((input) => {
        const redacted = redactSensitiveData(input);

        // Ensure no actual secrets leak
        expect(redacted).not.toContain("topsecret123");
        expect(redacted).not.toContain("realtoken");
        expect(redacted).not.toContain("realkey123456789abcdef");
        expect(redacted).not.toContain("MyRealPassword123!");

        // Ensure redaction markers are present
        expect(redacted).toContain("***REDACTED***");
      });
    });

    it("should handle edge cases safely", () => {
      const edgeCases = [null, undefined, "", {}, [], 123, true];

      edgeCases.forEach((input) => {
        // Should not throw errors
        expect(() => redactValue(input)).not.toThrow();
        expect(() => redactSensitiveData(String(input))).not.toThrow();
      });
    });
  });
});

// Export test data for use in other tests if needed
export { TEST_CASES };
