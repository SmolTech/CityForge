/**
 * Validation utilities for forum data.
 *
 * This module provides comprehensive validation that matches Flask's forum validation logic.
 */

import DOMPurify from "isomorphic-dompurify";

// Validation functions accept dynamic input data that may have any structure
/* eslint-disable @typescript-eslint/no-explicit-any */

// Helper type for validation input that allows dot notation access
// Using any here is intentional for validation input where structure is unknown
// and will be validated at runtime
type ValidationInput = any;

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T = unknown> {
  isValid: boolean;
  errors: ValidationError[];
  data: T | undefined;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Uses DOMPurify for robust XSS protection against:
 * - Nested tag bypasses: <<script>alert(1)</script>
 * - Self-closing tag bypasses: <img/src=x/onerror=alert(1)>
 * - SVG-based XSS: <svg/onload=alert(1)>
 * - HTML entity encoding attacks
 * - All other XSS vectors
 */
function sanitizeString(value: string): string {
  if (!value) return "";

  // Use DOMPurify to strip all HTML while preserving text content
  const clean = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [], // Remove all HTML tags
    KEEP_CONTENT: true, // Keep text content
  });

  return clean.trim();
}

// Forum Post validation
export interface ForumPostData {
  content: string;
}

export function validateForumPost(
  data: ValidationInput
): ValidationResult<ForumPostData> {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<ForumPostData> = {};

  // Required field: content
  if (!data.content || typeof data.content !== "string") {
    errors.push({ field: "content", message: "Content is required" });
  } else {
    const content = sanitizeString(data.content);
    if (content.length === 0) {
      errors.push({ field: "content", message: "Content cannot be empty" });
    } else if (content.length > 10000) {
      errors.push({
        field: "content",
        message: "Content must not exceed 10000 characters",
      });
    } else {
      sanitizedData.content = content;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? (sanitizedData as ForumPostData) : undefined,
  };
}

// Forum Thread validation
export interface ForumThreadData {
  title: string;
  content: string;
}

export function validateForumThread(
  data: ValidationInput
): ValidationResult<ForumThreadData> {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<ForumThreadData> = {};

  // Required field: title
  if (!data.title || typeof data.title !== "string") {
    errors.push({ field: "title", message: "Title is required" });
  } else {
    const title = sanitizeString(data.title);
    if (title.length === 0) {
      errors.push({ field: "title", message: "Title cannot be empty" });
    } else if (title.length > 255) {
      errors.push({
        field: "title",
        message: "Title must not exceed 255 characters",
      });
    } else {
      sanitizedData.title = title;
    }
  }

  // Required field: content
  if (!data.content || typeof data.content !== "string") {
    errors.push({ field: "content", message: "Content is required" });
  } else {
    const content = sanitizeString(data.content);
    if (content.length === 0) {
      errors.push({ field: "content", message: "Content cannot be empty" });
    } else if (content.length > 10000) {
      errors.push({
        field: "content",
        message: "Content must not exceed 10000 characters",
      });
    } else {
      sanitizedData.content = content;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? (sanitizedData as ForumThreadData) : undefined,
  };
}

// Forum Thread Update validation
export interface ForumThreadUpdateData {
  title: string;
}

export function validateForumThreadUpdate(
  data: ValidationInput
): ValidationResult<ForumThreadUpdateData> {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<ForumThreadUpdateData> = {};

  // Required field: title
  if (!data.title || typeof data.title !== "string") {
    errors.push({ field: "title", message: "Title is required" });
  } else {
    const title = sanitizeString(data.title);
    if (title.length === 0) {
      errors.push({ field: "title", message: "Title cannot be empty" });
    } else if (title.length > 255) {
      errors.push({
        field: "title",
        message: "Title must not exceed 255 characters",
      });
    } else {
      sanitizedData.title = title;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data:
      errors.length === 0
        ? (sanitizedData as ForumThreadUpdateData)
        : undefined,
  };
}

// Forum Category Request validation
export interface ForumCategoryRequestData {
  name: string;
  description: string;
  justification: string;
}

export function validateForumCategoryRequest(
  data: ValidationInput
): ValidationResult<ForumCategoryRequestData> {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<ForumCategoryRequestData> = {};

  // Required field: name
  if (!data.name || typeof data.name !== "string") {
    errors.push({ field: "name", message: "Name is required" });
  } else {
    const name = sanitizeString(data.name);
    if (name.length < 3) {
      errors.push({
        field: "name",
        message: "Name must be at least 3 characters",
      });
    } else if (name.length > 100) {
      errors.push({
        field: "name",
        message: "Name must not exceed 100 characters",
      });
    } else {
      sanitizedData.name = name;
    }
  }

  // Required field: description
  if (!data.description || typeof data.description !== "string") {
    errors.push({ field: "description", message: "Description is required" });
  } else {
    const description = sanitizeString(data.description);
    if (description.length < 10) {
      errors.push({
        field: "description",
        message: "Description must be at least 10 characters",
      });
    } else if (description.length > 1000) {
      errors.push({
        field: "description",
        message: "Description must not exceed 1000 characters",
      });
    } else {
      sanitizedData.description = description;
    }
  }

  // Required field: justification
  if (!data.justification || typeof data.justification !== "string") {
    errors.push({
      field: "justification",
      message: "Justification is required",
    });
  } else {
    const justification = sanitizeString(data.justification);
    if (justification.length < 10) {
      errors.push({
        field: "justification",
        message: "Justification must be at least 10 characters",
      });
    } else if (justification.length > 1000) {
      errors.push({
        field: "justification",
        message: "Justification must not exceed 1000 characters",
      });
    } else {
      sanitizedData.justification = justification;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data:
      errors.length === 0
        ? (sanitizedData as ForumCategoryRequestData)
        : undefined,
  };
}

// Forum Report validation
export interface ForumReportData {
  reason: "spam" | "inappropriate" | "harassment" | "off_topic" | "other";
  details?: string;
}

export function validateForumReport(
  data: ValidationInput
): ValidationResult<ForumReportData> {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<ForumReportData> = {};

  const validReasons = [
    "spam",
    "inappropriate",
    "harassment",
    "off_topic",
    "other",
  ];

  // Required field: reason
  if (!data.reason || typeof data.reason !== "string") {
    errors.push({ field: "reason", message: "Reason is required" });
  } else if (!validReasons.includes(data.reason)) {
    errors.push({
      field: "reason",
      message: `Invalid reason. Must be one of: ${validReasons.join(", ")}`,
    });
  } else {
    sanitizedData.reason = data.reason as ForumReportData["reason"];
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
    data: errors.length === 0 ? (sanitizedData as ForumReportData) : undefined,
  };
}
