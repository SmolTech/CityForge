/**
 * Test suite for reviews validation library
 * Comprehensive testing of review validation functions
 */

import { describe, it, expect } from "vitest";
import {
  validateReview,
  validateReviewUpdate,
  validateReviewReport,
} from "../reviews";

describe("validateReview", () => {
  describe("valid reviews", () => {
    it("should validate review with just rating", () => {
      const data = { rating: 4 };
      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual({ rating: 4 });
    });

    it("should validate complete review with all fields", () => {
      const data = {
        rating: 5,
        title: "Excellent service!",
        comment:
          "Had a wonderful experience at this business. Highly recommend!",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(data);
    });

    it("should accept all valid rating values (1-5)", () => {
      const validRatings = [1, 2, 3, 4, 5];

      validRatings.forEach((rating) => {
        const data = { rating };
        const result = validateReview(data);
        expect(result.isValid).toBe(true);
        expect(result.data?.rating).toBe(rating);
      });
    });

    it("should accept string numbers for rating", () => {
      const data = { rating: "4" };
      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.rating).toBe(4);
    });

    it("should sanitize HTML in text fields", () => {
      const data = {
        rating: 4,
        title: "Great <script>alert('xss')</script>service",
        comment: "Very <b>good</b> experience &amp; highly recommended",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).toBe("Great alert('xss')service");
      expect(result.data?.comment).toBe(
        "Very good experience & highly recommended"
      );
    });
  });

  describe("required field validation", () => {
    it("should reject review without rating", () => {
      const data = { title: "Great service" };
      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating is required",
      });
      expect(result.data).toBeUndefined();
    });

    it("should reject review with null rating", () => {
      const data = { rating: null };
      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating is required",
      });
    });

    it("should reject review with undefined rating", () => {
      const data = { rating: undefined };
      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating is required",
      });
    });
  });

  describe("rating validation", () => {
    it("should reject non-numeric rating", () => {
      const data = { rating: "not-a-number" };
      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating must be a number",
      });
    });

    it("should reject decimal rating", () => {
      const data = { rating: 3.5 };
      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating must be an integer",
      });
    });

    it("should reject rating below 1", () => {
      const invalidRatings = [0, -1, -5];

      invalidRatings.forEach((rating) => {
        const data = { rating };
        const result = validateReview(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "rating",
          message: "Rating must be between 1 and 5",
        });
      });
    });

    it("should reject rating above 5", () => {
      const invalidRatings = [6, 10, 100];

      invalidRatings.forEach((rating) => {
        const data = { rating };
        const result = validateReview(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "rating",
          message: "Rating must be between 1 and 5",
        });
      });
    });
  });

  describe("title validation", () => {
    it("should validate title within character limit", () => {
      const data = { rating: 4, title: "Great service!" };
      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).toBe("Great service!");
    });

    it("should reject title exceeding 255 characters", () => {
      const data = { rating: 4, title: "x".repeat(256) };
      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "title",
        message: "Title must not exceed 255 characters",
      });
    });

    it("should ignore non-string title", () => {
      const data = { rating: 4, title: 123 };
      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).toBeUndefined();
    });

    it("should handle empty title after sanitization", () => {
      const data = { rating: 4, title: "   " }; // Whitespace only
      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).toBeUndefined();
    });
  });

  describe("comment validation", () => {
    it("should validate comment within character limit", () => {
      const data = { rating: 4, comment: "Had a great experience!" };
      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.comment).toBe("Had a great experience!");
    });

    it("should reject comment exceeding 2000 characters", () => {
      const data = { rating: 4, comment: "x".repeat(2001) };
      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "comment",
        message: "Comment must not exceed 2000 characters",
      });
    });

    it("should ignore non-string comment", () => {
      const data = { rating: 4, comment: 123 };
      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.comment).toBeUndefined();
    });

    it("should handle empty comment after sanitization", () => {
      const data = { rating: 4, comment: "   " }; // Whitespace only
      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.comment).toBeUndefined();
    });
  });

  describe("multiple errors", () => {
    it("should collect multiple validation errors", () => {
      const data = {
        rating: 10, // Invalid range
        title: "x".repeat(256), // Too long
        comment: "x".repeat(2001), // Too long
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.data).toBeUndefined();

      const errorFields = result.errors.map((e) => e.field);
      expect(errorFields).toContain("rating");
      expect(errorFields).toContain("title");
      expect(errorFields).toContain("comment");
    });
  });
});

describe("validateReviewUpdate", () => {
  it("should use the same validation as validateReview", () => {
    const validData = { rating: 4, title: "Updated review" };
    const invalidData = { rating: 10 };

    const validResult = validateReviewUpdate(validData);
    const invalidResult = validateReviewUpdate(invalidData);

    expect(validResult.isValid).toBe(true);
    expect(validResult.data).toEqual(validData);

    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors).toContainEqual({
      field: "rating",
      message: "Rating must be between 1 and 5",
    });
  });
});

describe("validateReviewReport", () => {
  describe("valid reports", () => {
    it("should validate report with just reason", () => {
      const data = { reason: "spam" };
      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual({ reason: "spam" });
    });

    it("should validate complete report with reason and details", () => {
      const data = {
        reason: "inappropriate",
        details: "This review contains offensive language.",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(data);
    });

    it("should accept all valid reasons", () => {
      const validReasons = [
        "spam",
        "inappropriate",
        "harassment",
        "fake",
        "other",
      ];

      validReasons.forEach((reason) => {
        const data = { reason };
        const result = validateReviewReport(data);
        expect(result.isValid).toBe(true);
        expect(result.data?.reason).toBe(reason);
      });
    });

    it("should sanitize HTML in details field", () => {
      const data = {
        reason: "inappropriate",
        details:
          "Contains <script>alert('xss')</script>offensive content &amp; language",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.details).toBe(
        "Contains alert('xss')offensive content & language"
      );
    });
  });

  describe("required field validation", () => {
    it("should reject report without reason", () => {
      const data = { details: "Some details" };
      const result = validateReviewReport(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "reason",
        message: "Reason is required",
      });
      expect(result.data).toBeUndefined();
    });

    it("should reject report with non-string reason", () => {
      const data = { reason: 123 };
      const result = validateReviewReport(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "reason",
        message: "Reason is required",
      });
    });

    it("should reject report with null reason", () => {
      const data = { reason: null };
      const result = validateReviewReport(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "reason",
        message: "Reason is required",
      });
    });
  });

  describe("reason validation", () => {
    it("should reject invalid reason values", () => {
      const invalidReasons = [
        "invalid",
        "SPAM", // Case sensitive
        "harassment-type",
        "other-reason",
      ];

      invalidReasons.forEach((reason) => {
        const data = { reason };
        const result = validateReviewReport(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: "reason",
          message:
            "Invalid reason. Must be one of: spam, inappropriate, harassment, fake, other",
        });
      });
    });

    it("should reject empty string reason", () => {
      const data = { reason: "" };
      const result = validateReviewReport(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "reason",
        message: "Reason is required",
      });
    });
  });

  describe("details validation", () => {
    it("should validate details within character limit", () => {
      const data = {
        reason: "other",
        details: "This review violates community guidelines.",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.details).toBe(
        "This review violates community guidelines."
      );
    });

    it("should reject details exceeding 1000 characters", () => {
      const data = {
        reason: "other",
        details: "x".repeat(1001),
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "details",
        message: "Details must not exceed 1000 characters",
      });
    });

    it("should ignore non-string details", () => {
      const data = { reason: "spam", details: 123 };
      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.details).toBeUndefined();
    });

    it("should handle empty details after sanitization", () => {
      const data = { reason: "spam", details: "   " }; // Whitespace only
      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.details).toBeUndefined();
    });
  });

  describe("multiple errors", () => {
    it("should collect multiple validation errors", () => {
      const data = {
        reason: "invalid-reason", // Invalid value
        details: "x".repeat(1001), // Too long
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.data).toBeUndefined();

      const errorFields = result.errors.map((e) => e.field);
      expect(errorFields).toContain("reason");
      expect(errorFields).toContain("details");
    });
  });
});

describe("edge cases and security", () => {
  describe("HTML sanitization", () => {
    it("should remove script tags from all text fields", () => {
      const maliciousReview = {
        rating: 4,
        title: "Great<script>alert('xss')</script>service",
        comment: "<script src='evil.js'></script>Excellent experience",
      };

      const result = validateReview(maliciousReview);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).toBe("Greatalert('xss')service");
      expect(result.data?.comment).toBe("Excellent experience");
    });

    it("should handle HTML entities properly", () => {
      const data = {
        rating: 5,
        title: "Great &amp; Wonderful",
        comment: "We &quot;loved&quot; the &lt;amazing&gt; service",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).toBe("Great & Wonderful");
      expect(result.data?.comment).toBe('We "loved" the <amazing> service');
    });

    it("should sanitize review report details", () => {
      const maliciousReport = {
        reason: "inappropriate",
        details: "Contains <img src=x onerror=alert('xss')>malicious content",
      };

      const result = validateReviewReport(maliciousReport);

      expect(result.isValid).toBe(true);
      expect(result.data?.details).toBe("Contains malicious content");
    });
  });

  describe("type coercion and edge inputs", () => {
    it("should handle null and undefined values gracefully", () => {
      const data = {
        rating: 4,
        title: null,
        comment: undefined,
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ rating: 4 });
    });

    it("should handle numeric strings properly", () => {
      const data = {
        rating: "3",
        title: "123",
        comment: "456",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.rating).toBe(3);
      expect(result.data?.title).toBe("123");
      expect(result.data?.comment).toBe("456");
    });

    it("should handle very long strings gracefully", () => {
      const veryLongString = "x".repeat(10000);
      const data = {
        rating: 4,
        title: veryLongString,
        comment: veryLongString,
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "title",
        message: "Title must not exceed 255 characters",
      });
      expect(result.errors).toContainEqual({
        field: "comment",
        message: "Comment must not exceed 2000 characters",
      });
    });
  });
});
