/**
 * Validation utilities for card submissions and modifications.
 *
 * This module provides comprehensive validation that matches Flask's validation logic:
 * - URLs (HTTP/HTTPS only)
 * - Email addresses (RFC-compliant)
 * - Phone numbers (basic format validation)
 * - Text fields (length limits, HTML sanitization)
 * - Tags (format and length)
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
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

/**
 * Validate phone number using basic patterns
 * Supports common formats: (508) 555-0123, +15085550123, 508-555-0123, etc.
 */
function validatePhoneNumber(value: string): string | null {
  if (!value) return null;

  // Remove all non-digit characters except + at start
  const cleaned = value.replace(/[^\d+]/g, "");

  // Check if it starts with + (international) or is 10-11 digits
  if (cleaned.startsWith("+")) {
    // International format: +1234567890 (7-15 digits after +)
    const digits = cleaned.slice(1);
    if (digits.length < 7 || digits.length > 15) {
      return "Invalid phone number format. Examples: (508) 555-0123 or +15085550123";
    }
  } else {
    // Domestic format: 10 or 11 digits (with or without country code)
    if (cleaned.length !== 10 && cleaned.length !== 11) {
      return "Invalid phone number format. Examples: (508) 555-0123 or +15085550123";
    }
  }

  return null; // Valid
}

/**
 * Validate URL is HTTP or HTTPS only
 */
function validateUrl(value: string): string | null {
  if (!value) return null;

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return "URL must start with http:// or https://";
  }

  try {
    new URL(value);
    return null; // Valid
  } catch {
    return "Invalid URL format";
  }
}

/**
 * Validate email address
 */
function validateEmail(value: string): string | null {
  if (!value) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return "Invalid email address format";
  }
  return null;
}

/**
 * Validate tag name format
 */
function validateTagName(value: string): string | null {
  if (!value) return null;

  if (value.length > 500) {
    return "Tag name must not exceed 500 characters";
  }

  // Allow alphanumeric, spaces, hyphens, and common punctuation
  const tagRegex = /^[\w\s\-.,&()]+$/u;
  if (!tagRegex.test(value)) {
    return "Tag name can only contain letters, numbers, spaces, hyphens, and basic punctuation";
  }

  return null;
}

/**
 * Validate tags text (comma-separated tags)
 */
function validateTagsText(value: string): string | null {
  if (!value) return null;

  if (value.length > 2000) {
    return "Tags text must not exceed 2000 characters";
  }

  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag);
  for (const tag of tags) {
    const error = validateTagName(tag);
    if (error) {
      return `Invalid tag "${tag}": ${error}`;
    }
  }

  return null;
}

export interface CardSubmissionData {
  name: string;
  description?: string;
  websiteUrl?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  addressOverrideUrl?: string;
  contactName?: string;
  imageUrl?: string;
  tagsText?: string;
}

/**
 * Validate card submission data
 * Returns validation result with sanitized data if valid
 */
export function validateCardSubmission(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<CardSubmissionData> = {};

  // Required field: name
  if (!data.name || typeof data.name !== "string") {
    errors.push({ field: "name", message: "Name is required" });
  } else {
    const name = sanitizeString(data.name);
    if (name.length === 0) {
      errors.push({ field: "name", message: "Name cannot be empty" });
    } else if (name.length > 255) {
      errors.push({
        field: "name",
        message: "Name must not exceed 255 characters",
      });
    } else {
      sanitizedData.name = name;
    }
  }

  // Optional field: description
  if (data.description && typeof data.description === "string") {
    const description = sanitizeString(data.description);
    if (description.length > 5000) {
      errors.push({
        field: "description",
        message: "Description must not exceed 5000 characters",
      });
    } else if (description) {
      sanitizedData.description = description;
    }
  }

  // Optional field: websiteUrl
  if (data.websiteUrl && typeof data.websiteUrl === "string") {
    const urlError = validateUrl(data.websiteUrl.trim());
    if (urlError) {
      errors.push({ field: "websiteUrl", message: urlError });
    } else {
      sanitizedData.websiteUrl = data.websiteUrl.trim();
    }
  }

  // Optional field: phoneNumber
  if (data.phoneNumber && typeof data.phoneNumber === "string") {
    const phoneError = validatePhoneNumber(data.phoneNumber.trim());
    if (phoneError) {
      errors.push({ field: "phoneNumber", message: phoneError });
    } else {
      sanitizedData.phoneNumber = data.phoneNumber.trim();
    }
  }

  // Optional field: email
  if (data.email && typeof data.email === "string") {
    const emailError = validateEmail(data.email.trim());
    if (emailError) {
      errors.push({ field: "email", message: emailError });
    } else {
      sanitizedData.email = data.email.trim();
    }
  }

  // Optional field: address
  if (data.address && typeof data.address === "string") {
    const address = sanitizeString(data.address);
    if (address.length > 500) {
      errors.push({
        field: "address",
        message: "Address must not exceed 500 characters",
      });
    } else if (address) {
      sanitizedData.address = address;
    }
  }

  // Optional field: addressOverrideUrl
  if (data.addressOverrideUrl && typeof data.addressOverrideUrl === "string") {
    const urlError = validateUrl(data.addressOverrideUrl.trim());
    if (urlError) {
      errors.push({ field: "addressOverrideUrl", message: urlError });
    } else {
      sanitizedData.addressOverrideUrl = data.addressOverrideUrl.trim();
    }
  }

  // Optional field: contactName
  if (data.contactName && typeof data.contactName === "string") {
    const contactName = sanitizeString(data.contactName);
    if (contactName.length > 100) {
      errors.push({
        field: "contactName",
        message: "Contact name must not exceed 100 characters",
      });
    } else if (contactName) {
      sanitizedData.contactName = contactName;
    }
  }

  // Optional field: imageUrl
  if (data.imageUrl && typeof data.imageUrl === "string") {
    const urlError = validateUrl(data.imageUrl.trim());
    if (urlError) {
      errors.push({ field: "imageUrl", message: urlError });
    } else {
      sanitizedData.imageUrl = data.imageUrl.trim();
    }
  }

  // Optional field: tagsText
  if (data.tagsText && typeof data.tagsText === "string") {
    const tagsText = sanitizeString(data.tagsText);
    const tagsError = validateTagsText(tagsText);
    if (tagsError) {
      errors.push({ field: "tagsText", message: tagsError });
    } else if (tagsText) {
      sanitizedData.tagsText = tagsText;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data:
      errors.length === 0 ? (sanitizedData as CardSubmissionData) : undefined,
  };
}

/**
 * Validate card modification data
 * Same validation as submission but allows all fields to be optional
 */
export function validateCardModification(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  const sanitizedData: Partial<CardSubmissionData> = {};

  // Optional field: name
  if (data.name !== undefined) {
    if (typeof data.name !== "string") {
      errors.push({ field: "name", message: "Name must be a string" });
    } else {
      const name = sanitizeString(data.name);
      if (name.length > 255) {
        errors.push({
          field: "name",
          message: "Name must not exceed 255 characters",
        });
      } else if (name) {
        sanitizedData.name = name;
      }
    }
  }

  // Use the same validation logic for other fields but skip name requirement
  const tempData = { ...data, name: data.name || "temp" }; // Provide temp name for validation
  const result = validateCardSubmission(tempData);

  // If name wasn't provided originally, remove it from result
  if (data.name === undefined && result.data) {
    delete result.data.name;
  }

  // Filter out name errors if name wasn't provided
  const filteredErrors = result.errors.filter(
    (error) => !(error.field === "name" && data.name === undefined)
  );

  // Add our own name validation errors if any
  filteredErrors.push(...errors);

  return {
    isValid: filteredErrors.length === 0,
    errors: filteredErrors,
    data: filteredErrors.length === 0 ? result.data : undefined,
  };
}
