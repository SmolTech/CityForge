/**
 * Validation utilities for review data.
 *
 * This module provides comprehensive validation for review operations.
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: unknown;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes all HTML tags but preserves text content
 */
function sanitizeString(value: string): string {
  if (!value) return "";
  // Remove HTML tags and preserve line breaks
  return value
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&lt;/g, "<") // Decode HTML entities
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

// Review validation
export interface ReviewData {
  rating: number;
  title?: string;
  comment?: string;
}

export function validateReview(
  data: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<ReviewData> = {};

  // Required field: rating
  if (data.rating === undefined || data.rating === null) {
    errors.push({ field: "rating", message: "Rating is required" });
  } else {
    const rating = Number(data.rating);
    if (isNaN(rating)) {
      errors.push({ field: "rating", message: "Rating must be a number" });
    } else if (!Number.isInteger(rating)) {
      errors.push({ field: "rating", message: "Rating must be an integer" });
    } else if (rating < 1 || rating > 5) {
      errors.push({
        field: "rating",
        message: "Rating must be between 1 and 5",
      });
    } else {
      sanitizedData.rating = rating;
    }
  }

  // Optional field: title
  if (data.title && typeof data.title === "string") {
    const title = sanitizeString(data.title);
    if (title.length > 255) {
      errors.push({
        field: "title",
        message: "Title must not exceed 255 characters",
      });
    } else if (title) {
      sanitizedData.title = title;
    }
  }

  // Optional field: comment
  if (data.comment && typeof data.comment === "string") {
    const comment = sanitizeString(data.comment);
    if (comment.length > 2000) {
      errors.push({
        field: "comment",
        message: "Comment must not exceed 2000 characters",
      });
    } else if (comment) {
      sanitizedData.comment = comment;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? (sanitizedData as ReviewData) : undefined,
  };
}

// Review update validation (same as create but all fields optional except rating)
export function validateReviewUpdate(
  data: Record<string, unknown>
): ValidationResult {
  return validateReview(data);
}

// Review report validation
export interface ReviewReportData {
  reason: "spam" | "inappropriate" | "harassment" | "fake" | "other";
  details?: string;
}

export function validateReviewReport(
  data: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<ReviewReportData> = {};

  const validReasons = ["spam", "inappropriate", "harassment", "fake", "other"];

  // Required field: reason
  if (!data.reason || typeof data.reason !== "string") {
    errors.push({ field: "reason", message: "Reason is required" });
  } else if (!validReasons.includes(data.reason)) {
    errors.push({
      field: "reason",
      message: `Invalid reason. Must be one of: ${validReasons.join(", ")}`,
    });
  } else {
    sanitizedData.reason = data.reason as ReviewReportData["reason"];
  }

  // Optional field: details
  if (data.details && typeof data.details === "string") {
    const details = sanitizeString(data.details);
    if (details.length > 1000) {
      errors.push({
        field: "details",
        message: "Details must not exceed 1000 characters",
      });
    } else if (details) {
      sanitizedData.details = details;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? (sanitizedData as ReviewReportData) : undefined,
  };
}
