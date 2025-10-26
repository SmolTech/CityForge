/**
 * Phone number validation and formatting utilities.
 *
 * Validates and formats phone numbers to match backend expectations.
 * Backend accepts formats like:
 * - (508) 555-0123 (US local format)
 * - +15085550123 (international format)
 */

/**
 * Validate and format a phone number for submission to the backend.
 *
 * Accepts various input formats and normalizes them:
 * - (508) 555-0123 -> valid as-is
 * - 508-555-0123 -> (508) 555-0123
 * - 5085550123 -> (508) 555-0123
 * - +1 (508) 555-0123 -> +15085550123
 * - +15085550123 -> valid as-is
 *
 * @param phone - The phone number to validate
 * @returns The formatted phone number or null if invalid
 */
export function formatPhoneNumber(phone: string): string | null {
  if (!phone) {
    return null;
  }

  // Remove all non-digit characters except leading +
  const hasPlus = phone.trim().startsWith("+");
  const digits = phone.replace(/\D/g, "");

  // If it starts with +, format as international
  if (hasPlus) {
    // International format: must have country code (11+ digits for +1)
    if (digits.length >= 11) {
      return `+${digits}`;
    }
    return null; // Invalid international format
  }

  // US format: must be 10 digits
  if (digits.length === 10) {
    // Format as (XXX) XXX-XXXX
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // US format with leading 1: must be 11 digits
  if (digits.length === 11 && digits[0] === "1") {
    // Strip leading 1 and format as (XXX) XXX-XXXX
    const usDigits = digits.slice(1);
    return `(${usDigits.slice(0, 3)}) ${usDigits.slice(3, 6)}-${usDigits.slice(6)}`;
  }

  return null; // Invalid format
}

/**
 * Validate a phone number without formatting.
 *
 * @param phone - The phone number to validate
 * @returns True if the phone number is valid
 */
export function isValidPhoneNumber(phone: string): boolean {
  return formatPhoneNumber(phone) !== null;
}

/**
 * Get a user-friendly error message for invalid phone numbers.
 *
 * @returns Error message to display to users
 */
export function getPhoneValidationError(): string {
  return "Invalid phone number. Please use format: (508) 555-0123 or +15085550123";
}
