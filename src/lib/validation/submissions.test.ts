import { describe, it, expect } from "vitest";
import {
  validateCardSubmission,
  validateCardModification,
  ValidationResult,
  CardSubmissionData,
} from "./submissions";

describe("Submission Validation", () => {
  describe("validateCardSubmission", () => {
    it("should accept valid submission with required field only", () => {
      const data = {
        name: "Test Business",
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data?.name).toBe("Test Business");
    });

    it("should accept valid submission with all fields", () => {
      const data = {
        name: "Test Business",
        description: "A great business",
        websiteUrl: "https://example.com",
        phoneNumber: "(508) 555-0123",
        email: "test@example.com",
        address: "123 Main St",
        addressOverrideUrl: "https://maps.google.com/?q=123+Main+St",
        contactName: "John Doe",
        imageUrl: "https://example.com/image.jpg",
        tagsText: "restaurant, food, italian",
      };

      const result = validateCardSubmission(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data?.name).toBe("Test Business");
      expect(result.data?.websiteUrl).toBe("https://example.com");
    });

    describe("name validation", () => {
      it("should reject missing name", () => {
        const data = {};

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "name",
          message: "Name is required",
        });
      });

      it("should reject non-string name", () => {
        const data = {
          name: 12345,
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "name",
          message: "Name is required",
        });
      });

      it("should reject empty name after sanitization", () => {
        const data = {
          name: "   ",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "name",
          message: "Name cannot be empty",
        });
      });

      it("should reject name longer than 255 characters", () => {
        const data = {
          name: "a".repeat(256),
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "name",
          message: "Name must not exceed 255 characters",
        });
      });

      it("should sanitize HTML from name", () => {
        const data = {
          name: "<b>Test</b> <script>alert('xss')</script>Business",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.name).not.toContain("<b>");
        expect(result.data?.name).not.toContain("<script>");
        expect(result.data?.name).toContain("Test");
        expect(result.data?.name).toContain("Business");
      });

      it("should trim whitespace from name", () => {
        const data = {
          name: "  Test Business  ",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.name).toBe("Test Business");
      });
    });

    describe("description validation", () => {
      it("should accept valid description", () => {
        const data = {
          name: "Test",
          description: "A detailed description of the business",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.description).toBe(
          "A detailed description of the business"
        );
      });

      it("should reject description longer than 5000 characters", () => {
        const data = {
          name: "Test",
          description: "a".repeat(5001),
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "description",
          message: "Description must not exceed 5000 characters",
        });
      });

      it("should sanitize HTML from description", () => {
        const data = {
          name: "Test",
          description: "<p>Description</p> with <b>HTML</b>",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.description).not.toContain("<p>");
        expect(result.data?.description).not.toContain("<b>");
      });

      it("should skip empty description", () => {
        const data = {
          name: "Test",
          description: "",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.description).toBeUndefined();
      });
    });

    describe("websiteUrl validation", () => {
      it("should accept valid HTTP URL", () => {
        const data = {
          name: "Test",
          websiteUrl: "http://example.com",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.websiteUrl).toBe("http://example.com");
      });

      it("should accept valid HTTPS URL", () => {
        const data = {
          name: "Test",
          websiteUrl: "https://example.com",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.websiteUrl).toBe("https://example.com");
      });

      it("should reject URL without protocol", () => {
        const data = {
          name: "Test",
          websiteUrl: "example.com",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "websiteUrl",
          message: "URL must start with http:// or https://",
        });
      });

      it("should reject URL with invalid protocol", () => {
        const data = {
          name: "Test",
          websiteUrl: "ftp://example.com",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "websiteUrl",
          message: "URL must start with http:// or https://",
        });
      });

      it("should reject URL longer than 2000 characters", () => {
        const data = {
          name: "Test",
          websiteUrl: "https://example.com/" + "a".repeat(2000),
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "websiteUrl",
          message: "URL must not exceed 2000 characters",
        });
      });

      it("should reject malformed URL", () => {
        const data = {
          name: "Test",
          websiteUrl: "https://",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "websiteUrl",
          message: "Invalid URL format",
        });
      });

      it("should trim whitespace from URL", () => {
        const data = {
          name: "Test",
          websiteUrl: "  https://example.com  ",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.websiteUrl).toBe("https://example.com");
      });
    });

    describe("phoneNumber validation", () => {
      it("should accept valid US phone format", () => {
        const validPhones = [
          "(508) 555-0123",
          "508-555-0123",
          "5085550123",
          "508.555.0123",
        ];

        validPhones.forEach((phone) => {
          const data = {
            name: "Test",
            phoneNumber: phone,
          };

          const result = validateCardSubmission(data);

          expect(result.isValid).toBe(true);
        });
      });

      it("should accept international phone format", () => {
        const data = {
          name: "Test",
          phoneNumber: "+15085550123",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.phoneNumber).toBe("+15085550123");
      });

      it("should reject phone with too few digits", () => {
        const data = {
          name: "Test",
          phoneNumber: "123",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "phoneNumber",
          message:
            "Invalid phone number format. Examples: (508) 555-0123 or +15085550123",
        });
      });

      it("should reject phone with too many digits", () => {
        const data = {
          name: "Test",
          phoneNumber: "+1234567890123456",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "phoneNumber",
          message:
            "Invalid phone number format. Examples: (508) 555-0123 or +15085550123",
        });
      });
    });

    describe("email validation", () => {
      it("should accept valid email", () => {
        const data = {
          name: "Test",
          email: "test@example.com",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.email).toBe("test@example.com");
      });

      it("should reject invalid email format", () => {
        const data = {
          name: "Test",
          email: "invalid-email",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "email",
          message: "Invalid email address format",
        });
      });

      it("should trim whitespace from email", () => {
        const data = {
          name: "Test",
          email: "  test@example.com  ",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.email).toBe("test@example.com");
      });
    });

    describe("address validation", () => {
      it("should accept valid address", () => {
        const data = {
          name: "Test",
          address: "123 Main Street, Boston, MA 02101",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.address).toBe("123 Main Street, Boston, MA 02101");
      });

      it("should reject address longer than 500 characters", () => {
        const data = {
          name: "Test",
          address: "a".repeat(501),
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "address",
          message: "Address must not exceed 500 characters",
        });
      });

      it("should sanitize HTML from address", () => {
        const data = {
          name: "Test",
          address: "<script>alert('xss')</script>123 Main St",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.address).not.toContain("<script>");
      });
    });

    describe("addressOverrideUrl validation", () => {
      it("should accept valid address override URL", () => {
        const data = {
          name: "Test",
          addressOverrideUrl: "https://maps.google.com/?q=123+Main+St",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.addressOverrideUrl).toBe(
          "https://maps.google.com/?q=123+Main+St"
        );
      });

      it("should reject invalid address override URL", () => {
        const data = {
          name: "Test",
          addressOverrideUrl: "not-a-url",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "addressOverrideUrl",
          message: "URL must start with http:// or https://",
        });
      });
    });

    describe("contactName validation", () => {
      it("should accept valid contact name", () => {
        const data = {
          name: "Test",
          contactName: "John Doe",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.contactName).toBe("John Doe");
      });

      it("should reject contact name longer than 100 characters", () => {
        const data = {
          name: "Test",
          contactName: "a".repeat(101),
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "contactName",
          message: "Contact name must not exceed 100 characters",
        });
      });

      it("should sanitize HTML from contact name", () => {
        const data = {
          name: "Test",
          contactName: "<b>John</b> <i>Doe</i>",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.contactName).not.toContain("<b>");
        expect(result.data?.contactName).toContain("John");
      });
    });

    describe("imageUrl validation", () => {
      it("should accept valid image URL", () => {
        const data = {
          name: "Test",
          imageUrl: "https://example.com/image.jpg",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.imageUrl).toBe("https://example.com/image.jpg");
      });

      it("should reject invalid image URL", () => {
        const data = {
          name: "Test",
          imageUrl: "not-a-url",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "imageUrl",
          message: "URL must start with http:// or https://",
        });
      });
    });

    describe("tagsText validation", () => {
      it("should accept valid comma-separated tags", () => {
        const data = {
          name: "Test",
          tagsText: "restaurant, food, italian",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
        expect(result.data?.tagsText).toBe("restaurant, food, italian");
      });

      it("should reject tags text longer than 2000 characters", () => {
        const data = {
          name: "Test",
          tagsText: "a".repeat(2001),
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "tagsText",
          message: "Tags text must not exceed 2000 characters",
        });
      });

      it("should reject invalid tag characters", () => {
        const data = {
          name: "Test",
          tagsText: "valid-tag, invalid~tag!, another",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]!.field).toBe("tagsText");
        expect(result.errors[0]!.message).toContain("Invalid tag");
      });

      it("should accept tags with hyphens and ampersands", () => {
        const data = {
          name: "Test",
          tagsText: "food-service, bed-&-breakfast, mom-and-pop",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(true);
      });
    });

    describe("multiple validation errors", () => {
      it("should return all validation errors at once", () => {
        const data = {
          name: "",
          websiteUrl: "invalid",
          email: "invalid-email",
          phoneNumber: "123",
        };

        const result = validateCardSubmission(data);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });
  });

  describe("validateCardModification", () => {
    it("should accept valid modification with required field only", () => {
      const data = {
        name: "Updated Business Name",
      };

      const result = validateCardModification(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data?.name).toBe("Updated Business Name");
    });

    it("should accept modification with all fields", () => {
      const data = {
        name: "Updated Business",
        description: "Updated description",
        websiteUrl: "https://newsite.com",
        phoneNumber: "(508) 555-9999",
        email: "new@example.com",
        address: "456 New St",
        addressOverrideUrl: "https://maps.google.com/?q=456+New+St",
        contactName: "Jane Smith",
        imageUrl: "https://newsite.com/image.jpg",
        tagsText: "updated, tags",
      };

      const result = validateCardModification(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should use same validation rules as submission", () => {
      const data = {
        name: "a".repeat(256),
      };

      const result = validateCardModification(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "name",
        message: "Name must not exceed 255 characters",
      });
    });
  });
});
