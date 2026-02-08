import { NextRequest } from "next/server";

/**
 * Extract client IP address from request headers
 * Handles various proxy headers in order of preference
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers in order of preference
  const headers = [
    "x-real-ip",
    "x-forwarded-for",
    "x-client-ip",
    "cf-connecting-ip", // Cloudflare
    "true-client-ip", // Cloudflare Enterprise
    "x-forwarded",
    "forwarded-for",
    "forwarded",
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // X-Forwarded-For can contain multiple IPs, check each one
      const ips = value.split(",").map((ip) => ip.trim());
      for (const ip of ips) {
        if (ip && isValidIP(ip)) {
          return ip;
        }
      }
    }
  }

  // Fallback to connection remote address if available
  // Note: This might not be available in all deployment scenarios
  const remoteAddress = (request as { ip?: string }).ip;
  if (remoteAddress && isValidIP(remoteAddress)) {
    return remoteAddress;
  }

  // Default fallback
  return "unknown";
}

/**
 * Basic IP address validation
 * Supports both IPv4 and IPv6 addresses
 */
export function isValidIP(ip: string): boolean {
  // Remove any surrounding whitespace
  const cleanIP = ip.trim();

  // IPv4 validation
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  if (ipv4Regex.test(cleanIP)) {
    return true;
  }

  // IPv6 validation - use more comprehensive approach
  try {
    // Simple approach: if it contains colons and valid hex characters, it's likely IPv6
    if (cleanIP.includes(":")) {
      // Basic IPv6 pattern check
      const ipv6Pattern = /^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
      const ipv6CompressedPattern = /^::$/;
      const ipv6MixedPattern = /^.*::.*$/;

      return (
        ipv6Pattern.test(cleanIP) ||
        ipv6CompressedPattern.test(cleanIP) ||
        ipv6MixedPattern.test(cleanIP)
      );
    }
  } catch {
    return false;
  }

  return false;
}
