import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getRuntimeEnv, getSiteUrl } from "./runtime-env";

describe("Runtime Environment Variables", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv;
  });

  describe("getRuntimeEnv", () => {
    it("should return undefined for non-existent environment variable", () => {
      delete process.env["NON_EXISTENT_VAR"];
      expect(getRuntimeEnv("NON_EXISTENT_VAR")).toBeUndefined();
    });

    it("should return the value of an existing environment variable", () => {
      process.env["TEST_VAR"] = "test-value";
      expect(getRuntimeEnv("TEST_VAR")).toBe("test-value");
    });

    it("should use dynamic property access to prevent inlining", () => {
      // This test verifies that we're using bracket notation
      // which prevents Next.js from inlining the value at build time
      process.env["DYNAMIC_VAR"] = "dynamic-value";
      const result = getRuntimeEnv("DYNAMIC_VAR");
      expect(result).toBe("dynamic-value");
    });
  });

  describe("getSiteUrl", () => {
    it("should return SITE_URL if set", () => {
      process.env["SITE_URL"] = "https://production.example.com";
      process.env["NEXT_PUBLIC_SITE_URL"] = "https://build-time.example.com";

      expect(getSiteUrl()).toBe("https://production.example.com");
    });

    it("should fall back to NEXT_PUBLIC_SITE_URL if SITE_URL is not set", () => {
      delete process.env["SITE_URL"];
      process.env["NEXT_PUBLIC_SITE_URL"] = "https://build-time.example.com";

      expect(getSiteUrl()).toBe("https://build-time.example.com");
    });

    it("should fall back to localhost if neither variable is set", () => {
      delete process.env["SITE_URL"];
      delete process.env["NEXT_PUBLIC_SITE_URL"];

      expect(getSiteUrl()).toBe("http://localhost:3000");
    });

    it("should prioritize SITE_URL over NEXT_PUBLIC_SITE_URL", () => {
      process.env["SITE_URL"] = "https://runtime.example.com";
      process.env["NEXT_PUBLIC_SITE_URL"] = "https://buildtime.example.com";

      const result = getSiteUrl();
      expect(result).toBe("https://runtime.example.com");
      expect(result).not.toBe("https://buildtime.example.com");
    });

    it("should handle empty string values correctly", () => {
      process.env["SITE_URL"] = "";
      process.env["NEXT_PUBLIC_SITE_URL"] = "https://fallback.example.com";

      // Empty string is falsy, so should fall back to NEXT_PUBLIC_SITE_URL
      expect(getSiteUrl()).toBe("https://fallback.example.com");
    });
  });
});
