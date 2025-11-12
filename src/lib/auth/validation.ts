/**
 * Validation utilities for authentication endpoints
 * Replicates the validation logic from Flask Marshmallow schemas
 */

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface UserRegistrationData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface UserLoginData {
  email: string;
  password: string;
}

/**
 * Validate email format using a simple regex
 */
function validateEmail(email: string): string[] {
  const errors: string[] = [];

  if (!email) {
    errors.push("Email is required");
    return errors;
  }

  // Length validation (prevent DoS with extremely long emails)
  if (email.length > 255) {
    errors.push("Email must not exceed 255 characters");
    return errors;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push("Invalid email format");
  }

  return errors;
}

/**
 * Validate password strength
 * Follows OWASP recommendations for secure passwords
 */
function validatePassword(password: string): string[] {
  const errors: string[] = [];

  if (!password) {
    errors.push("Password is required");
    return errors;
  }

  // Minimum length increased from 8 to 12 characters (OWASP recommendation)
  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long");
  }

  if (password.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Added special character requirement for stronger passwords
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return errors;
}

/**
 * Sanitize string by removing HTML tags (basic implementation)
 */
function sanitizeString(value: string): string {
  if (!value) return "";
  // Remove basic HTML tags - in production, use a proper sanitization library
  return value.replace(/<[^>]*>/g, "").trim();
}

/**
 * Validate name fields
 */
function validateName(name: string, fieldName: string): string[] {
  const errors: string[] = [];

  if (!name) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  const sanitized = sanitizeString(name);
  if (sanitized.length < 1) {
    errors.push(`${fieldName} must not be empty`);
  }

  if (sanitized.length > 50) {
    errors.push(`${fieldName} must not exceed 50 characters`);
  }

  return errors;
}

/**
 * Validate user registration data
 */
export function validateUserRegistration(
  data: any
): ValidationResult<UserRegistrationData> {
  const errors: Record<string, string[]> = {};

  // Validate email
  const emailErrors = validateEmail(data["email"]);
  if (emailErrors.length > 0) {
    errors["email"] = emailErrors;
  }

  // Validate password
  const passwordErrors = validatePassword(data["password"]);
  if (passwordErrors.length > 0) {
    errors["password"] = passwordErrors;
  }

  // Validate first name
  const firstNameErrors = validateName(data["first_name"], "First name");
  if (firstNameErrors.length > 0) {
    errors["first_name"] = firstNameErrors;
  }

  // Validate last name
  const lastNameErrors = validateName(data["last_name"], "Last name");
  if (lastNameErrors.length > 0) {
    errors["last_name"] = lastNameErrors;
  }

  // Return validation result
  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      email: data["email"].toLowerCase().trim(),
      password: data["password"],
      first_name: sanitizeString(data["first_name"]),
      last_name: sanitizeString(data["last_name"]),
    },
  };
}

/**
 * Validate user login data
 */
export function validateUserLogin(data: any): ValidationResult<UserLoginData> {
  const errors: Record<string, string[]> = {};

  // Validate email
  const emailErrors = validateEmail(data["email"]);
  if (emailErrors.length > 0) {
    errors["email"] = emailErrors;
  }

  // Validate password presence (don't validate strength for login)
  if (!data["password"]) {
    errors["password"] = ["Password is required"];
  }

  // Return validation result
  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      email: data["email"].toLowerCase().trim(),
      password: data["password"],
    },
  };
}
