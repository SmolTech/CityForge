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
 * Matches frontend validation requirements
 */
function validatePassword(password: string): string[] {
  const errors: string[] = [];

  if (!password) {
    errors.push("Password is required");
    return errors;
  }

  // Minimum length: 8 characters
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
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
  data: Record<string, unknown>
): ValidationResult<UserRegistrationData> {
  const errors: Record<string, string[]> = {};

  // Validate email
  const emailErrors = validateEmail(String(data["email"] ?? ""));
  if (emailErrors.length > 0) {
    errors["email"] = emailErrors;
  }

  // Validate password
  const passwordErrors = validatePassword(String(data["password"] ?? ""));
  if (passwordErrors.length > 0) {
    errors["password"] = passwordErrors;
  }

  // Validate first name
  const firstNameErrors = validateName(
    String(data["first_name"] ?? ""),
    "First name"
  );
  if (firstNameErrors.length > 0) {
    errors["first_name"] = firstNameErrors;
  }

  // Validate last name
  const lastNameErrors = validateName(
    String(data["last_name"] ?? ""),
    "Last name"
  );
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
      email: String(data["email"]).toLowerCase().trim(),
      password: String(data["password"]),
      first_name: sanitizeString(String(data["first_name"])),
      last_name: sanitizeString(String(data["last_name"])),
    },
  };
}

/**
 * Validate user login data
 */
export function validateUserLogin(
  data: Record<string, unknown>
): ValidationResult<UserLoginData> {
  const errors: Record<string, string[]> = {};

  // Validate email
  const emailErrors = validateEmail(String(data["email"] ?? ""));
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
      email: String(data["email"]).toLowerCase().trim(),
      password: String(data["password"]),
    },
  };
}

/**
 * Validate password strength (exported for password reset)
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors = validatePassword(password);
  return {
    valid: errors.length === 0,
    errors,
  };
}
