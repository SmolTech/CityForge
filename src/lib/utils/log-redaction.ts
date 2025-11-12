/**
 * Log redaction utility for preventing sensitive data exposure
 *
 * This module provides utilities to redact sensitive information from logs,
 * including passwords, tokens, API keys, database credentials, and PII.
 *
 * Security Features:
 * - Database URL credential redaction
 * - JWT token redaction
 * - API key/secret redaction
 * - Email address redaction (production only)
 * - Credit card and SSN redaction
 * - Session ID redaction
 */

/**
 * Redact credentials from database URLs
 */
export function redactDatabaseUrl(url: string): string {
  if (!url || typeof url !== "string") {
    return "***INVALID_URL***";
  }

  try {
    const parsed = new URL(url);

    // Check if this is a standard protocol (http, https, ftp, database protocols)
    const standardProtocols = [
      "http:",
      "https:",
      "ftp:",
      "ftps:",
      "postgresql:",
      "mysql:",
      "mongodb:",
      "redis:",
      "sqlite:",
    ];

    const isStandardProtocol = standardProtocols.some(
      (protocol) => parsed.protocol === protocol
    );

    if (isStandardProtocol && parsed.password) {
      parsed.password = "***REDACTED***";
      return parsed.toString();
    } else if (!isStandardProtocol) {
      // Non-standard protocol, likely a malformed URL - use regex redaction
      if (url.includes(":") && url.includes("@")) {
        return url.replace(/:([^:@]+)@/, ":***REDACTED***@");
      }
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, try regex-based redaction for malformed URLs
    // Handle patterns like: somestring:password@host
    if (url.includes(":") && url.includes("@")) {
      return url.replace(/:([^:@]+)@/, ":***REDACTED***@");
    }
    return url;
  }
}

/**
 * Sensitive data patterns for redaction
 */
const SENSITIVE_PATTERNS = [
  // Passwords in various formats (including pwd, passwd)
  {
    pattern: /(?:password|pwd|passwd)["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi,
    replacement: (match: string) => {
      const prefix = match.split(/[:=]/)[0];
      return `${prefix}: "***REDACTED***"`;
    },
  },

  // API keys and secrets
  {
    pattern:
      /(?:api[_-]?key|secret[_-]?key|access[_-]?key)["']?\s*[:=]\s*["']?([A-Za-z0-9\-._~+\/]{8,})["']?/gi,
    replacement: (match: string) => {
      const parts = match.split(/[:=]/);
      const prefix = parts[0];
      const hasQuotes = match.includes('"') || match.includes("'");
      return `${prefix}: ${hasQuotes ? '"***REDACTED***"' : "***REDACTED***"}`;
    },
  },

  // JWT tokens (Bearer and raw)
  {
    pattern: /Bearer\s+([A-Za-z0-9\-._~+\/]+=*)/gi,
    replacement: "Bearer ***REDACTED***",
  },
  {
    pattern: /(?:token|jwt)["']?\s*[:=]\s*["']?([A-Za-z0-9\-._~+\/]{20,})/gi,
    replacement: (match: string) =>
      match.replace(/([A-Za-z0-9\-._~+\/]{20,})/, "***REDACTED***"),
  },

  // Database credentials in URLs
  {
    pattern: /(postgresql|mysql|mongodb):\/\/([^:]+):([^@]+)@/gi,
    replacement: "$1://$2:***REDACTED***@",
  },

  // Generic malformed URLs with credentials
  {
    pattern: /([^:]+):([^@]+)@([^/\s]+)/g,
    replacement: (match: string) => {
      if (match.includes("://")) {
        return match; // Let URL patterns handle this
      }
      return match.replace(/:([^@]+)@/, ":***REDACTED***@");
    },
  },

  // Credit card numbers (basic pattern)
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "****-****-****-****",
  },

  // Social Security Numbers
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "***-**-****",
  },

  // Session IDs (common formats)
  {
    pattern:
      /(?:session[_-]?id|sess)["']?\s*[:=]\s*["']?([A-Za-z0-9]{8,})["']?/gi,
    replacement: (match: string) => {
      const parts = match.split(/[:=]/);
      const prefix = parts[0];
      const hasQuotes = match.includes('"') || match.includes("'");
      return `${prefix}: ${hasQuotes ? '"***REDACTED***"' : "***REDACTED***"}`;
    },
  },
];

/**
 * Email patterns (for production redaction)
 */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * Redact sensitive data from a string
 */
export function redactSensitiveData(
  input: string,
  options: {
    redactEmails?: boolean;
    environment?: string;
  } = {}
): string {
  if (!input || typeof input !== "string") {
    return String(input);
  }

  let redacted = input;

  // Apply all sensitive patterns
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    if (typeof replacement === "function") {
      redacted = redacted.replace(pattern, replacement);
    } else {
      redacted = redacted.replace(pattern, replacement);
    }
  }

  // Redact emails in production only (unless explicitly requested)
  const shouldRedactEmails =
    options.redactEmails ||
    options.environment === "production" ||
    process.env.NODE_ENV === "production";

  if (shouldRedactEmails) {
    redacted = redacted.replace(EMAIL_PATTERN, "***EMAIL_REDACTED***");
  }

  return redacted;
}

/**
 * Redact sensitive data from any value (string, object, array)
 */
export function redactValue(
  value: unknown,
  options: {
    redactEmails?: boolean;
    environment?: string;
  } = {}
): unknown {
  if (typeof value === "string") {
    return redactSensitiveData(value, options);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, options));
  }

  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Special handling for known sensitive keys
      if (isSensitiveKey(key)) {
        redacted[key] = "***REDACTED***";
      } else {
        redacted[key] = redactValue(val, options);
      }
    }
    return redacted;
  }

  return value;
}

/**
 * Check if a key name indicates sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const sensitiveKeys = [
    "password",
    "passwd",
    "pwd",
    "secret",
    "key",
    "token",
    "auth",
    "credential",
    "authorization",
    "apikey",
    "api_key",
    "access_key",
    "private_key",
    "session_id",
    "sessionid",
  ];

  const lowerKey = key.toLowerCase();
  return sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive));
}

/**
 * Safely redact multiple arguments for logging
 */
export function redactLogArguments(
  args: unknown[],
  options: {
    redactEmails?: boolean;
    environment?: string;
  } = {}
): unknown[] {
  return args.map((arg) => redactValue(arg, options));
}
