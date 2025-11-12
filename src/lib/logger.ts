/**
 * Frontend logging utility with sensitive data redaction
 *
 * Provides conditional logging based on environment:
 * - Development: All logs (info, warn, debug) are output to console with basic redaction
 * - Production: Only errors are logged to console with comprehensive redaction
 *
 * This prevents sensitive information and debug logs from appearing
 * in production browser consoles while maintaining error visibility.
 *
 * Security Features:
 * - Automatic redaction of passwords, tokens, API keys
 * - Database credential protection
 * - Email redaction in production
 * - Credit card and SSN protection
 */

import { redactLogArguments } from "./utils/log-redaction";

const isProduction = process.env.NODE_ENV === "production";
const environment = process.env.NODE_ENV || "development";

export const logger = {
  /**
   * Log informational messages (development only)
   * Arguments are automatically redacted for sensitive data
   */
  info: (...args: unknown[]) => {
    if (!isProduction) {
      const redactedArgs = redactLogArguments(args, {
        environment,
        redactEmails: false, // Don't redact emails in development for debugging
      });
      console.log(...redactedArgs);
    }
  },

  /**
   * Log errors (all environments)
   * Errors are always logged to help with debugging production issues
   * Arguments are automatically redacted for sensitive data
   */
  error: (...args: unknown[]) => {
    const redactedArgs = redactLogArguments(args, {
      environment,
      redactEmails: isProduction, // Redact emails in production only
    });
    console.error(...redactedArgs);
  },

  /**
   * Log warnings (development only)
   * Arguments are automatically redacted for sensitive data
   */
  warn: (...args: unknown[]) => {
    if (!isProduction) {
      const redactedArgs = redactLogArguments(args, {
        environment,
        redactEmails: false,
      });
      console.warn(...redactedArgs);
    }
  },

  /**
   * Log debug messages (development only)
   * Arguments are automatically redacted for sensitive data
   */
  debug: (...args: unknown[]) => {
    if (!isProduction) {
      const redactedArgs = redactLogArguments(args, {
        environment,
        redactEmails: false,
      });
      console.debug(...redactedArgs);
    }
  },

  /**
   * Log raw messages without redaction (use with extreme caution)
   * Only for cases where you're certain no sensitive data is present
   */
  raw: {
    info: (...args: unknown[]) => {
      if (!isProduction) {
        console.log(...args);
      }
    },
    error: (...args: unknown[]) => {
      console.error(...args);
    },
    warn: (...args: unknown[]) => {
      if (!isProduction) {
        console.warn(...args);
      }
    },
    debug: (...args: unknown[]) => {
      if (!isProduction) {
        console.debug(...args);
      }
    },
  },
};
