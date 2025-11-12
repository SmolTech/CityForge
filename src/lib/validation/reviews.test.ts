import { describe, it, expect } from "vitest";
import {
  validateReview,
  validateReviewUpdate,
  validateReviewReport,
} from "./reviews";

describe("Review Validation", () => {
  describe("validateReview", () => {
    it("should accept valid review data", () => {
      const data = {
        rating: 5,
        title: "Great service!",
        comment: "Really enjoyed my experience here.",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data?.rating).toBe(5);
    });

    it("should accept review with only rating (no title or comment)", () => {
      const data = {
        rating: 4,
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject review without rating", () => {
      const data = {
        title: "Great place",
        comment: "Excellent service",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating is required",
      });
    });

    it("should reject rating below 1", () => {
      const data = {
        rating: 0,
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating must be between 1 and 5",
      });
    });

    it("should reject rating above 5", () => {
      const data = {
        rating: 6,
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating must be between 1 and 5",
      });
    });

    it("should reject non-integer rating", () => {
      const data = {
        rating: 3.5,
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating must be an integer",
      });
    });

    it("should sanitize HTML in title", () => {
      const data = {
        rating: 5,
        title: "<script>alert('xss')</script>Great place",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).not.toContain("<script>");
      expect(result.data?.title).toContain("Great place");
    });

    it("should sanitize HTML in comment", () => {
      const data = {
        rating: 5,
        comment: "<b>Bold text</b> and <script>alert('xss')</script>",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.comment).not.toContain("<b>");
      expect(result.data?.comment).not.toContain("<script>");
    });

    it("should reject title that is too long", () => {
      const data = {
        rating: 5,
        title: "a".repeat(256),
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "title",
        message: "Title must not exceed 255 characters",
      });
    });

    it("should reject comment that is too long", () => {
      const data = {
        rating: 5,
        comment: "a".repeat(2001),
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "comment",
        message: "Comment must not exceed 2000 characters",
      });
    });

    it("should trim whitespace from title and comment", () => {
      const data = {
        rating: 5,
        title: "  Great place  ",
        comment: "  Excellent service  ",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).toBe("Great place");
      expect(result.data?.comment).toBe("Excellent service");
    });

    it("should handle empty strings for optional fields", () => {
      const data = {
        rating: 5,
        title: "",
        comment: "",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
    });

    it("should convert string rating to number", () => {
      const data = {
        rating: "4",
      };

      const result = validateReview(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.rating).toBe(4);
    });
  });

  describe("validateReviewUpdate", () => {
    it("should accept valid update data with rating", () => {
      const data = {
        rating: 4,
        title: "Updated title",
        comment: "Updated comment",
      };

      const result = validateReviewUpdate(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should require rating (validateReviewUpdate calls validateReview)", () => {
      const data = {
        title: "New title",
      };

      const result = validateReviewUpdate(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating is required",
      });
    });

    it("should reject invalid rating in update", () => {
      const data = {
        rating: 10,
      };

      const result = validateReviewUpdate(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "rating",
        message: "Rating must be between 1 and 5",
      });
    });

    it("should sanitize HTML in update", () => {
      const data = {
        rating: 5,
        title: "<script>xss</script>Title",
        comment: "<b>Comment</b>",
      };

      const result = validateReviewUpdate(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.title).not.toContain("<script>");
      expect(result.data?.comment).not.toContain("<b>");
    });
  });

  describe("validateReviewReport", () => {
    it("should accept valid report data", () => {
      const data = {
        reason: "spam",
        details: "This review is spam advertising",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data?.reason).toBe("spam");
    });

    it("should accept report without details", () => {
      const data = {
        reason: "inappropriate",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
    });

    it("should reject report without reason", () => {
      const data = {
        details: "Some details",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "reason",
        message: "Reason is required",
      });
    });

    it("should reject invalid reason", () => {
      const data = {
        reason: "invalid_reason",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "reason",
        message: expect.stringContaining("Invalid reason. Must be one of"),
      });
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
      });
    });

    it("should reject details that are too long", () => {
      const data = {
        reason: "spam",
        details: "a".repeat(1001),
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "details",
        message: "Details must not exceed 1000 characters",
      });
    });

    it("should sanitize HTML in details", () => {
      const data = {
        reason: "spam",
        details: "<script>alert('xss')</script>Spam content",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.details).not.toContain("<script>");
      expect(result.data?.details).toContain("Spam content");
    });

    it("should trim whitespace from details", () => {
      const data = {
        reason: "spam",
        details: "  Spam review  ",
      };

      const result = validateReviewReport(data);

      expect(result.isValid).toBe(true);
      expect(result.data?.details).toBe("Spam review");
    });
  });
});
