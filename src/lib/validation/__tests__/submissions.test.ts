/**
 * Test suite for submissions validation library
 * Comprehensive testing of card submission and modification validation
 */

import { describe, it, expect } from "vitest";
import {
  validateCardSubmission,
  validateCardModification,
} from "../submissions";

describe("validateCardSubmission", () => {
  describe("valid submissions", () => {
    it("should validate minimal valid submission with just name", () => {
      const data = { name: "Valid Business" };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual({ name: "Valid Business" });
    });

    it("should validate complete valid submission with all fields", () => {
      const data = {
        name: "Complete Business",
        description: "A great business with excellent service",
        websiteUrl: "https://example.com",
        phoneNumber: "(555) 123-4567",
        email: "contact@example.com",
        address: "123 Main St, City, State",
        addressOverrideUrl: "https://maps.google.com/example",
        contactName: "John Doe",
        imageUrl: "https://example.com/image.jpg",
        tagsText: "restaurant, food, dining",
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(data);
    });

    it("should sanitize HTML in text fields", () => {
      const data = {
        name: "Business <script>alert('xss')</script>Name",
        description: "Description with <b>bold</b> and &amp; entities",
        contactName: "Contact &lt;Name&gt;",
        tagsText: "tag1, tag2, simple tags",
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.name).toBe("Business alert('xss')Name");
      expect(result.data?.description).toBe(
        "Description with bold and & entities"
      );
      expect(result.data?.contactName).toBe("Contact <Name>");
      expect(result.data?.tagsText).toBe("tag1, tag2, simple tags");
    });

    it("should accept various valid phone number formats", () => {
      const phoneNumbers = [
        "(508) 555-0123",
        "508-555-0123",
        "5085550123",
        "+15085550123",
        "+44 20 7946 0958", // UK number
      ];

      phoneNumbers.forEach((phone) => {
        const data = { name: "Test", phoneNumber: phone };
        const result = validateCardSubmission(data);
        expect(result.isValid).toBe(true);
        expect(result.data?.phoneNumber).toBe(phone);
      });
    });

    it("should accept various valid URL formats", () => {
      const urls = [
        "http://example.com",
        "https://example.com",
        "https://sub.example.com/path?param=value",
        "http://localhost:3000",
        "https://example.org/path/to/page.html",
      ];

      urls.forEach((url) => {
        const data = { name: "Test", websiteUrl: url };
        const result = validateCardSubmission(data);
        expect(result.isValid).toBe(true);
        expect(result.data?.websiteUrl).toBe(url);
      });
    });
  });

  describe("required field validation", () => {
    it("should reject submission without name", () => {
      const data = { description: "No name provided" };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "name",
        message: "Name is required",
      });
      expect(result.data).toBeUndefined();
    });

    it("should reject submission with empty name", () => {
      const data = { name: "   " }; // Whitespace only
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "name",
        message: "Name cannot be empty",
      });
    });

    it("should reject submission with non-string name", () => {
      const data = { name: 123 };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "name",
        message: "Name is required",
      });
    });
  });

  describe("field length validation", () => {
    it("should reject name exceeding 255 characters", () => {
      const data = { name: "x".repeat(256) };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "name",
        message: "Name must not exceed 255 characters",
      });
    });

    it("should reject description exceeding 5000 characters", () => {
      const data = { name: "Test", description: "x".repeat(5001) };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "description",
        message: "Description must not exceed 5000 characters",
      });
    });

    it("should reject address exceeding 500 characters", () => {
      const data = { name: "Test", address: "x".repeat(501) };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "address",
        message: "Address must not exceed 500 characters",
      });
    });

    it("should reject contact name exceeding 100 characters", () => {
      const data = { name: "Test", contactName: "x".repeat(101) };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "contactName",
        message: "Contact name must not exceed 100 characters",
      });
    });
  });

  describe("URL validation", () => {
    it("should reject URLs without http/https protocol", () => {
      const invalidUrls = [
        "example.com",
        "ftp://example.com",
        "javascript:alert('xss')",
        "//example.com",
      ];

      invalidUrls.forEach((url) => {
        const data = { name: "Test", websiteUrl: url };
        const result = validateCardSubmission(data);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.field === "websiteUrl")).toBe(true);
      });
    });

    it("should reject invalid URL formats", () => {
      const invalidUrls = ["http://", "https://", "not-a-url"];

      invalidUrls.forEach((url) => {
        const data = { name: "Test", websiteUrl: url };
        const result = validateCardSubmission(data);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.field === "websiteUrl")).toBe(true);
      });
    });

    it("should reject URLs exceeding 2000 characters", () => {
      const longUrl = "https://example.com/" + "x".repeat(2000);
      const data = { name: "Test", websiteUrl: longUrl };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "websiteUrl",
        message: "URL must not exceed 2000 characters",
      });
    });
  });

  describe("phone number validation", () => {
    it("should reject invalid phone number formats", () => {
      const invalidPhones = [
        "123",
        "abc",
        "+123", // Too short
        "1".repeat(16), // Too long
        "+1".repeat(16), // Too long international
      ];

      invalidPhones.forEach((phone) => {
        const data = { name: "Test", phoneNumber: phone };
        const result = validateCardSubmission(data);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.field === "phoneNumber")).toBe(true);
      });
    });
  });

  describe("email validation", () => {
    it("should reject invalid email formats", () => {
      const invalidEmails = [
        "invalid-email",
        "@example.com",
        "user@",
        "user@.com",
        "user@com",
        "user name@example.com", // Space
      ];

      invalidEmails.forEach((email) => {
        const data = { name: "Test", email };
        const result = validateCardSubmission(data);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.field === "email")).toBe(true);
      });
    });

    it("should accept valid email formats", () => {
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.org",
        "123@example.net",
      ];

      validEmails.forEach((email) => {
        const data = { name: "Test", email };
        const result = validateCardSubmission(data);
        expect(result.isValid).toBe(true);
        expect(result.data?.email).toBe(email);
      });
    });
  });

  describe("tags validation", () => {
    it("should validate comma-separated tags", () => {
      const data = { name: "Test", tagsText: "tag1, tag2, tag3" };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.tagsText).toBe("tag1, tag2, tag3");
    });

    it("should reject invalid tag characters", () => {
      // Use actual invalid characters that won't be sanitized away
      const invalidTags = "tag1, invalid#symbol, tag3";
      const data = { name: "Test", tagsText: invalidTags };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "tagsText")).toBe(true);
      // Check that the error message contains information about invalid characters
      const tagError = result.errors.find((e) => e.field === "tagsText");
      expect(tagError?.message).toContain("invalid#symbol");
    });

    it("should reject tags text exceeding 2000 characters", () => {
      const data = { name: "Test", tagsText: "x".repeat(2001) };
      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "tagsText",
        message: "Tags text must not exceed 2000 characters",
      });
    });
  });

  describe("multiple errors", () => {
    it("should collect multiple validation errors", () => {
      const data = {
        // Missing name (required)
        description: "x".repeat(5001), // Too long
        websiteUrl: "invalid-url", // Invalid format
        phoneNumber: "123", // Invalid format
        email: "invalid-email", // Invalid format
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(5);
      expect(result.data).toBeUndefined();

      // Check that all expected errors are present
      const errorFields = result.errors.map((e) => e.field);
      expect(errorFields).toContain("name");
      expect(errorFields).toContain("description");
      expect(errorFields).toContain("websiteUrl");
      expect(errorFields).toContain("phoneNumber");
      expect(errorFields).toContain("email");
    });
  });
});

describe("validateCardModification", () => {
  describe("valid modifications", () => {
    it("should validate empty modification (all fields optional)", () => {
      const data = {};
      const result = validateCardModification(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual({});
    });

    it("should validate partial modification", () => {
      const data = {
        name: "Updated Name",
        description: "Updated description",
      };

      const result = validateCardModification(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(data);
    });

    it("should allow undefined values for all fields", () => {
      const data = {
        name: undefined,
        description: undefined,
        websiteUrl: undefined,
        phoneNumber: undefined,
        email: undefined,
      };

      const result = validateCardModification(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual({});
    });
  });

  describe("field validation", () => {
    it("should validate name field when provided", () => {
      const data = { name: "Updated Business Name" };
      const result = validateCardModification(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.name).toBe("Updated Business Name");
    });

    it("should reject name that's not a string", () => {
      const data = { name: 123 };
      const result = validateCardModification(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "name",
        message: "Name must be a string",
      });
    });

    it("should handle empty string name", () => {
      const data = { name: "  " }; // Whitespace only
      const result = validateCardModification(data);

      // Empty strings after sanitization are not included in the result
      expect(result.isValid).toBe(true);
      expect(result.data?.name).toBeUndefined();
    });

    it("should validate same constraints as submission for other fields", () => {
      const data = {
        name: "x".repeat(256), // Too long
        description: "x".repeat(5001), // Too long
        websiteUrl: "invalid-url", // Invalid format
        phoneNumber: "123", // Invalid format
        email: "invalid-email", // Invalid format
      };

      const result = validateCardModification(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const errorFields = result.errors.map((e) => e.field);
      expect(errorFields).toContain("name");
      expect(errorFields).toContain("description");
      expect(errorFields).toContain("websiteUrl");
      expect(errorFields).toContain("phoneNumber");
      expect(errorFields).toContain("email");
    });
  });
});

describe("edge cases and security", () => {
  describe("HTML sanitization", () => {
    it("should remove script tags from all text fields", () => {
      const maliciousData = {
        name: "Business<script>alert('xss')</script>",
        description: "<script src='evil.js'></script>Description",
        contactName: "<img src=x onerror=alert('xss')>Contact",
        address: "<iframe src='javascript:alert(1)'></iframe>Address",
        tagsText: "tag1<script>, tag2</script>",
      };

      const result = validateCardSubmission(maliciousData);

      expect(result.isValid).toBe(true);
      expect(result.data?.name).toBe("Businessalert('xss')");
      expect(result.data?.description).toBe("Description");
      expect(result.data?.contactName).toBe("Contact");
      expect(result.data?.address).toBe("Address");
      expect(result.data?.tagsText).toBe("tag1, tag2");
    });

    it("should handle HTML entities properly", () => {
      const data = {
        name: "Business &amp; Co",
        description: "We &quot;serve&quot; &lt;great&gt; food",
        contactName: "John &#x27;Doe&#x27;",
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.name).toBe("Business & Co");
      expect(result.data?.description).toBe('We "serve" <great> food');
      expect(result.data?.contactName).toBe("John 'Doe'");
    });
  });

  describe("type coercion and edge inputs", () => {
    it("should handle null and undefined values gracefully", () => {
      const data = {
        name: "Test",
        description: null,
        websiteUrl: undefined,
        phoneNumber: null,
        email: "",
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ name: "Test" });
    });

    it("should handle numeric strings in text fields", () => {
      const data = {
        name: "123",
        description: "456",
        contactName: "789",
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.name).toBe("123");
      expect(result.data?.description).toBe("456");
      expect(result.data?.contactName).toBe("789");
    });

    it("should handle very long strings gracefully", () => {
      const veryLongString = "x".repeat(10000);
      const data = {
        name: "Test",
        description: veryLongString,
        tagsText: veryLongString,
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "description",
        message: "Description must not exceed 5000 characters",
      });
      expect(result.errors).toContainEqual({
        field: "tagsText",
        message: "Tags text must not exceed 2000 characters",
      });
    });
  });
});
