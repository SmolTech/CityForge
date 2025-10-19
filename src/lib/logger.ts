/**
 * Frontend logging utility
 *
 * Provides conditional logging based on environment:
 * - Development: All logs (info, warn, debug) are output to console
 * - Production: Only errors are logged to console
 *
 * This prevents sensitive information and debug logs from appearing
 * in production browser consoles while maintaining error visibility.
 */

const isProduction = process.env.NODE_ENV === "production";

export const logger = {
  /**
   * Log informational messages (development only)
   */
  info: (...args: unknown[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },

  /**
   * Log errors (all environments)
   * Errors are always logged to help with debugging production issues
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Log warnings (development only)
   */
  warn: (...args: unknown[]) => {
    if (!isProduction) {
      console.warn(...args);
    }
  },

  /**
   * Log debug messages (development only)
   */
  debug: (...args: unknown[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  },
};
