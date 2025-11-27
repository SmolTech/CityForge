import { NextRequest, NextResponse } from "next/server";

/**
 * Security Headers Configuration for CityForge
 *
 * Implements comprehensive security headers following industry best practices:
 * - Content Security Policy (CSP) to prevent XSS attacks
 * - HTTP Strict Transport Security (HSTS) for secure connections
 * - X-Frame-Options to prevent clickjacking
 * - X-Content-Type-Options to prevent MIME sniffing
 * - Referrer-Policy for privacy protection
 * - Permissions-Policy for feature access control
 */

interface SecurityHeadersConfig {
  /**
   * Environment-specific configuration
   */
  environment: "development" | "staging" | "production";

  /**
   * Whether to enforce HTTPS-only policies
   */
  httpsOnly: boolean;

  /**
   * Additional CSP directives for specific environments
   */
  additionalCSPDirectives?: Record<string, string>;

  /**
   * Custom nonce for inline scripts (optional)
   */
  nonce?: string;
}

/**
 * Determine security environment from environment variables
 */
function getSecurityEnvironment(): "development" | "staging" | "production" {
  // Check for explicit security mode override
  const securityMode = process.env["SECURITY_HEADERS_MODE"];
  if (
    securityMode &&
    ["development", "staging", "production"].includes(securityMode)
  ) {
    return securityMode as "development" | "staging" | "production";
  }

  // Fall back to NODE_ENV
  return (
    (process.env.NODE_ENV as "development" | "staging" | "production") ||
    "development"
  );
}

/**
 * Check if production-level security should be enabled
 */
function isProductionSecurityEnabled(): boolean {
  // Check for explicit strict security override
  const strictSecurity = process.env["SECURITY_HEADERS_STRICT"];
  if (strictSecurity === "true") {
    return true;
  }

  // Default to production security in production environment
  return process.env.NODE_ENV === "production";
}

/**
 * Parse additional CSP directives from environment variable
 */
function getAdditionalCSPDirectives(): Record<string, string> {
  const additionalDirectives =
    process.env["SECURITY_CSP_ADDITIONAL_DIRECTIVES"];
  if (!additionalDirectives) {
    return {};
  }

  try {
    return JSON.parse(additionalDirectives);
  } catch (error) {
    console.warn(
      "Invalid SECURITY_CSP_ADDITIONAL_DIRECTIVES format, ignoring:",
      error
    );
    return {};
  }
}

/**
 * Check if CSP nonce is enabled
 */
function isCSPNonceEnabled(): boolean {
  return process.env["SECURITY_CSP_NONCE_ENABLED"] === "true";
}

/**
 * Default security headers configuration
 */
const DEFAULT_CONFIG: SecurityHeadersConfig = {
  environment: getSecurityEnvironment(),
  httpsOnly: isProductionSecurityEnabled(),
  additionalCSPDirectives: getAdditionalCSPDirectives(),
};

/**
 * Content Security Policy directives based on CityForge requirements
 */
function buildCSPDirectives(
  config: SecurityHeadersConfig
): Record<string, string> {
  const baseDirectives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": "'self' 'unsafe-inline'", // unsafe-inline needed for Next.js App Router hydration
    "style-src": "'self' 'unsafe-inline'", // unsafe-inline needed for Tailwind CSS
    "img-src": "'self' data: blob:", // Allow data URLs for images and user uploads
    "font-src": "'self' data:",
    "connect-src": "'self'",
    "media-src": "'self'",
    "object-src": "'none'", // Block all object embeds for security
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'", // Prevent framing (clickjacking protection)
    "manifest-src": "'self'",
    "worker-src": "'self'",
  };

  // Environment-specific adjustments
  if (config.environment === "development") {
    // Development needs more permissive CSP for hot reload and dev tools
    baseDirectives["script-src"] = "'self' 'unsafe-eval' 'unsafe-inline'";
    baseDirectives["connect-src"] = "'self' ws: wss:"; // WebSocket for hot reload
  }

  // Add nonce support for inline scripts if provided
  if (config.nonce) {
    baseDirectives["script-src"] += ` 'nonce-${config.nonce}'`;
  }

  // Merge with additional directives if provided
  if (config.additionalCSPDirectives) {
    Object.assign(baseDirectives, config.additionalCSPDirectives);
  }

  return baseDirectives;
}

/**
 * Build Content Security Policy header value
 */
function buildCSPHeader(config: SecurityHeadersConfig): string {
  const directives = buildCSPDirectives(config);
  return Object.entries(directives)
    .map(([directive, value]) => `${directive} ${value}`)
    .join("; ");
}

/**
 * Build HTTP Strict Transport Security (HSTS) header
 */
function buildHSTSHeader(config: SecurityHeadersConfig): string {
  if (!config.httpsOnly) {
    return ""; // Don't set HSTS for non-HTTPS environments
  }

  // 1 year max-age with includeSubDomains for production
  return "max-age=31536000; includeSubDomains";
}

/**
 * Build Permissions Policy header for feature access control
 */
function buildPermissionsPolicyHeader(): string {
  // Restrictive permissions policy - only allow essential features
  const policies = [
    "accelerometer=()", // Block accelerometer access
    "autoplay=()", // Block autoplay
    "camera=()", // Block camera access unless needed
    "cross-origin-isolated=()", // Block cross-origin isolation
    "display-capture=()", // Block screen capture
    "encrypted-media=()", // Block encrypted media
    "fullscreen=(self)", // Allow fullscreen for our origin only
    "geolocation=()", // Block geolocation unless needed
    "gyroscope=()", // Block gyroscope
    "keyboard-map=()", // Block keyboard mapping
    "magnetometer=()", // Block magnetometer
    "microphone=()", // Block microphone unless needed
    "midi=()", // Block MIDI access
    "payment=()", // Block payment APIs unless needed
    "picture-in-picture=()", // Block picture-in-picture
    "publickey-credentials-get=()", // Block WebAuthn unless needed
    "screen-wake-lock=()", // Block screen wake lock
    "sync-xhr=()", // Block synchronous XHR
    "usb=()", // Block USB access
    "web-share=()", // Block web share API
    "xr-spatial-tracking=()", // Block VR/AR tracking
  ];

  return policies.join(", ");
}

/**
 * Get all security headers for a request
 */
export function getSecurityHeaders(
  request?: NextRequest,
  config: Partial<SecurityHeadersConfig> = {}
): Record<string, string> {
  // Use request context for security decisions if available
  const isSecure = request
    ? isSecureContext(request)
    : DEFAULT_CONFIG.httpsOnly;

  const fullConfig: SecurityHeadersConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    httpsOnly: config.httpsOnly ?? isSecure,
  };

  // Generate nonce if enabled
  if (isCSPNonceEnabled() && !fullConfig.nonce) {
    fullConfig.nonce = generateCSPNonce();
  }

  const headers: Record<string, string> = {
    // Content Security Policy
    "Content-Security-Policy": buildCSPHeader(fullConfig),

    // X-Frame-Options (legacy support, CSP frame-ancestors is preferred)
    "X-Frame-Options": "DENY",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Referrer Policy for privacy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions Policy for feature access control
    "Permissions-Policy": buildPermissionsPolicyHeader(),

    // X-DNS-Prefetch-Control
    "X-DNS-Prefetch-Control": "off",

    // Cross-Origin Embedder Policy
    "Cross-Origin-Embedder-Policy": "require-corp",

    // Cross-Origin Opener Policy
    "Cross-Origin-Opener-Policy": "same-origin",

    // Cross-Origin Resource Policy
    "Cross-Origin-Resource-Policy": "same-site",
  };

  // Add HSTS header for HTTPS environments
  const hstsHeader = buildHSTSHeader(fullConfig);
  if (hstsHeader) {
    headers["Strict-Transport-Security"] = hstsHeader;
  }

  return headers;
}

/**
 * Apply security headers to a NextResponse
 */
export function addSecurityHeaders(
  response: NextResponse,
  request?: NextRequest,
  config: Partial<SecurityHeadersConfig> = {}
): NextResponse {
  const headers = getSecurityHeaders(request, config);

  Object.entries(headers).forEach(([name, value]) => {
    response.headers.set(name, value);
  });

  return response;
}

/**
 * Create a NextResponse with security headers applied
 */
export function createSecureResponse(
  body?: unknown,
  init?: ResponseInit,
  request?: NextRequest,
  config: Partial<SecurityHeadersConfig> = {}
): NextResponse {
  const response = NextResponse.json(body, init);
  return addSecurityHeaders(response, request, config);
}

/**
 * Utility function to check if request is from a secure context (HTTPS)
 */
export function isSecureContext(request: NextRequest): boolean {
  const protocol =
    request.headers.get("x-forwarded-proto") || request.nextUrl.protocol;
  return protocol === "https:" || request.nextUrl.hostname === "localhost";
}

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateCSPNonce(): string {
  // In a real application, you would generate this server-side
  // For now, we'll use a simple timestamp-based approach
  return Buffer.from(`nonce-${Date.now()}-${Math.random()}`).toString("base64");
}

/**
 * Get security headers for static files (images, CSS, JS)
 */
export function getStaticFileSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Cache control for static assets
    "Cache-Control": "public, max-age=31536000, immutable",
  };
}

/**
 * Validate Content Security Policy directive
 */
export function validateCSPDirective(
  directive: string,
  value: string
): boolean {
  const validDirectives = [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "font-src",
    "connect-src",
    "media-src",
    "object-src",
    "base-uri",
    "form-action",
    "frame-ancestors",
    "manifest-src",
    "worker-src",
    "child-src",
    "frame-src",
  ];

  if (!validDirectives.includes(directive)) {
    return false;
  }

  // Basic validation - no semicolons in values (could break CSP)
  return !value.includes(";");
}

export type { SecurityHeadersConfig };
