/**
 * Secure logger for mobile app
 *
 * Prevents sensitive data from being logged in production builds.
 * Uses redaction utilities to protect tokens, passwords, and other sensitive data.
 */

/**
 * Redact sensitive data patterns from log messages
 */
function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map(redactValue);
    }

    // Redact object properties
    const redacted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();

      // Redact sensitive keys entirely
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("jwt") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("key")
      ) {
        redacted[key] = "***REDACTED***";
      } else {
        redacted[key] = redactValue(val);
      }
    }
    return redacted;
  }

  return value;
}

/**
 * Redact sensitive patterns from strings
 */
function redactString(str: string): string {
  return (
    str
      // JWT tokens (header.payload.signature format)
      .replace(
        /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "***JWT_TOKEN_REDACTED***"
      )
      // Bearer tokens
      .replace(/Bearer\s+[A-Za-z0-9_-]+/gi, "Bearer ***REDACTED***")
      // API keys (long alphanumeric strings)
      .replace(
        /(?:api[_-]?key|access[_-]?key|secret)\s*[:=]\s*["']?([A-Za-z0-9_-]{20,})/gi,
        "$&***REDACTED***"
      )
      // Passwords in JSON/object notation
      .replace(
        /password["']?\s*[:=]\s*["']?[^"'\s,}]+/gi,
        'password: "***REDACTED***"'
      )
      // Credit card numbers
      .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "***CC_REDACTED***")
      // SSN format
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***SSN_REDACTED***")
      // Email addresses (in production only)
      .replace(
        __DEV__
          ? /(?!)/
          : /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        "***EMAIL_REDACTED***"
      )
  );
}

/**
 * Safe logger that redacts sensitive information
 */
export const logger = {
  info: (...args: unknown[]) => {
    if (__DEV__) {
      console.info(...args.map(redactValue));
    }
  },

  warn: (...args: unknown[]) => {
    if (__DEV__) {
      console.warn(...args.map(redactValue));
    }
  },

  error: (...args: unknown[]) => {
    // Always log errors, but redact sensitive data
    console.error(...args.map(redactValue));
  },

  debug: (...args: unknown[]) => {
    if (__DEV__) {
      console.debug(...args.map(redactValue));
    }
  },

  /**
   * Raw logging without redaction (use only when certain no sensitive data is present)
   */
  raw: {
    info: (...args: unknown[]) => {
      if (__DEV__) {
        console.info(...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (__DEV__) {
        console.warn(...args);
      }
    },
    error: (...args: unknown[]) => {
      console.error(...args);
    },
    debug: (...args: unknown[]) => {
      if (__DEV__) {
        console.debug(...args);
      }
    },
  },
};
