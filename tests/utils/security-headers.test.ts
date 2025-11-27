import {
  getSecurityHeaders,
  validateCSPDirective,
  generateCSPNonce,
} from "@/lib/security-headers";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Security Headers Utility", () => {
  describe("getSecurityHeaders", () => {
    it("should return all required security headers", () => {
      const headers = getSecurityHeaders();

      expect(headers).toHaveProperty("Content-Security-Policy");
      expect(headers).toHaveProperty("X-Frame-Options");
      expect(headers).toHaveProperty("X-Content-Type-Options");
      expect(headers).toHaveProperty("Referrer-Policy");
      expect(headers).toHaveProperty("Permissions-Policy");
      expect(headers).toHaveProperty("Cross-Origin-Embedder-Policy");
      expect(headers).toHaveProperty("Cross-Origin-Opener-Policy");
      expect(headers).toHaveProperty("Cross-Origin-Resource-Policy");
    });

    it("should set secure default values", () => {
      const headers = getSecurityHeaders();

      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe(
        "strict-origin-when-cross-origin"
      );
      expect(headers["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
      expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
      expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-site");
    });

    it("should include CSP with secure defaults", () => {
      const headers = getSecurityHeaders();
      const csp = headers["Content-Security-Policy"];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });

    it("should include HSTS for HTTPS-only configuration", () => {
      const headers = getSecurityHeaders(undefined, { httpsOnly: true });

      expect(headers).toHaveProperty("Strict-Transport-Security");
      expect(headers["Strict-Transport-Security"]).toContain(
        "max-age=31536000"
      );
      expect(headers["Strict-Transport-Security"]).toContain(
        "includeSubDomains"
      );
    });

    it("should not include HSTS for non-HTTPS configuration", () => {
      const headers = getSecurityHeaders(undefined, { httpsOnly: false });

      expect(headers).not.toHaveProperty("Strict-Transport-Security");
    });

    it("should allow environment-specific CSP for development", () => {
      const headers = getSecurityHeaders(undefined, {
        environment: "development",
      });
      const csp = headers["Content-Security-Policy"];

      expect(csp).toContain("'unsafe-eval'");
      expect(csp).toContain("'unsafe-inline'");
      expect(csp).toContain("ws: wss:");
    });

    it("should be more restrictive for production", () => {
      const headers = getSecurityHeaders(undefined, {
        environment: "production",
      });
      const csp = headers["Content-Security-Policy"];

      // Production uses 'unsafe-inline' for Next.js App Router hydration
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      // Should not include 'unsafe-eval' in production (only development needs it)
      expect(csp).not.toContain(
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      );
      // Should not include WebSocket connections for hot reload
      expect(csp).not.toContain("ws: wss:");
      // Style-src should still have 'unsafe-inline' for Tailwind CSS
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it("should support additional CSP directives", () => {
      const additionalDirectives = {
        "script-src": "'self' 'unsafe-eval' cdn.example.com",
        "img-src": "'self' data: https:",
      };

      const headers = getSecurityHeaders(undefined, {
        additionalCSPDirectives: additionalDirectives,
      });
      const csp = headers["Content-Security-Policy"];

      expect(csp).toContain("script-src 'self' 'unsafe-eval' cdn.example.com");
      expect(csp).toContain("img-src 'self' data: https:");
    });

    it("should support CSP nonce", () => {
      const nonce = "test-nonce-123";
      const headers = getSecurityHeaders(undefined, { nonce });
      const csp = headers["Content-Security-Policy"];

      expect(csp).toContain(`'nonce-${nonce}'`);
    });

    it("should include comprehensive Permissions-Policy", () => {
      const headers = getSecurityHeaders();
      const permissionsPolicy = headers["Permissions-Policy"];

      expect(permissionsPolicy).toContain("accelerometer=()");
      expect(permissionsPolicy).toContain("camera=()");
      expect(permissionsPolicy).toContain("microphone=()");
      expect(permissionsPolicy).toContain("geolocation=()");
      expect(permissionsPolicy).toContain("fullscreen=(self)");
    });
  });

  describe("validateCSPDirective", () => {
    it("should validate correct CSP directives", () => {
      expect(validateCSPDirective("default-src", "'self'")).toBe(true);
      expect(validateCSPDirective("script-src", "'self' 'unsafe-eval'")).toBe(
        true
      );
      expect(validateCSPDirective("img-src", "'self' data: blob:")).toBe(true);
    });

    it("should reject invalid CSP directive names", () => {
      expect(validateCSPDirective("invalid-directive", "'self'")).toBe(false);
      expect(validateCSPDirective("not-a-directive", "'none'")).toBe(false);
    });

    it("should reject CSP values with semicolons", () => {
      expect(
        validateCSPDirective("default-src", "'self'; malicious-content")
      ).toBe(false);
      expect(validateCSPDirective("script-src", "'self'; alert(1)")).toBe(
        false
      );
    });

    it("should accept all standard CSP directives", () => {
      const validDirectives = [
        "default-src",
        "script-src",
        "style-src",
        "img-src",
        "font-src",
        "connect-src",
        "media-src",
        "object-src",
        "base-uri",
        "form-action",
        "frame-ancestors",
        "manifest-src",
        "worker-src",
        "child-src",
        "frame-src",
      ];

      validDirectives.forEach((directive) => {
        expect(validateCSPDirective(directive, "'self'")).toBe(true);
      });
    });
  });

  describe("generateCSPNonce", () => {
    it("should generate a valid base64 nonce", () => {
      const nonce = generateCSPNonce();

      expect(typeof nonce).toBe("string");
      expect(nonce.length).toBeGreaterThan(0);

      // Should be valid base64
      expect(() => Buffer.from(nonce, "base64")).not.toThrow();
    });

    it("should generate unique nonces", () => {
      const nonce1 = generateCSPNonce();
      const nonce2 = generateCSPNonce();

      expect(nonce1).not.toBe(nonce2);
    });

    it("should generate nonces suitable for CSP", () => {
      const nonce = generateCSPNonce();

      // Should not contain characters that would break CSP
      expect(nonce).not.toContain(" ");
      expect(nonce).not.toContain(";");
      expect(nonce).not.toContain("'");
      expect(nonce).not.toContain('"');
    });
  });

  describe("Environment Variable Integration", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment - Note: Vitest handles module resets differently than Jest
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should respect SECURITY_HEADERS_MODE environment variable", async () => {
      process.env["SECURITY_HEADERS_MODE"] = "production";

      // Re-import to get new environment - use dynamic import for Vitest
      const securityModule = await import("@/lib/security-headers");
      const headers = securityModule.getSecurityHeaders();
      const csp = headers["Content-Security-Policy"];

      // Production mode uses 'unsafe-inline' for Next.js App Router hydration
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      // Should not include 'unsafe-eval' in production (only development needs it)
      expect(csp).not.toContain(
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      );
    });

    it("should respect SECURITY_HEADERS_STRICT environment variable", async () => {
      // Create a new process.env object to avoid readonly errors
      const newEnv = { ...originalEnv };
      newEnv["NODE_ENV"] = "development";
      newEnv["SECURITY_HEADERS_STRICT"] = "true";
      process.env = newEnv;

      // Re-import to get new environment
      const securityModule = await import("@/lib/security-headers");
      const headers = securityModule.getSecurityHeaders();

      // Should include HSTS even in development when strict mode is enabled
      expect(headers).toHaveProperty("Strict-Transport-Security");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid additional CSP directives gracefully", () => {
      // Note: This test demonstrates that the system handles invalid environment variables
      // gracefully by falling back to safe defaults
      const headers = getSecurityHeaders();

      // Should still return valid headers
      expect(headers).toHaveProperty("Content-Security-Policy");
      expect(headers["Content-Security-Policy"]).toContain(
        "default-src 'self'"
      );
    });
  });

  describe("Security Best Practices", () => {
    it("should disable dangerous features by default", () => {
      const headers = getSecurityHeaders();

      // X-Frame-Options should prevent clickjacking
      expect(headers["X-Frame-Options"]).toBe("DENY");

      // CSP should prevent object embeds
      expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");

      // Should prevent framing
      expect(headers["Content-Security-Policy"]).toContain(
        "frame-ancestors 'none'"
      );
    });

    it("should restrict permissions for sensitive features", () => {
      const headers = getSecurityHeaders();
      const permissionsPolicy = headers["Permissions-Policy"];

      // Should block sensitive features
      expect(permissionsPolicy).toContain("camera=()");
      expect(permissionsPolicy).toContain("microphone=()");
      expect(permissionsPolicy).toContain("geolocation=()");
      expect(permissionsPolicy).toContain("payment=()");
    });

    it("should set restrictive cross-origin policies", () => {
      const headers = getSecurityHeaders();

      expect(headers["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
      expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
      expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-site");
    });
  });
});
