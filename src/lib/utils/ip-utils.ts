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
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ip = value.split(",")[0]?.trim();
      if (ip && isValidIP(ip)) {
        return ip;
      }
    }
  }

  // Fallback to connection remote address if available
  // Note: This might not be available in all deployment scenarios
  const remoteAddress = (request as any).ip;
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
function isValidIP(ip: string): boolean {
  // Remove any port number
  const cleanIP = ip.split(":").slice(0, -1).join(":") || ip;

  // IPv4 validation
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 validation (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  const ipv6CompressedRegex =
    /^((?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*)?)::((?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*)?)$/;

  return (
    ipv4Regex.test(cleanIP) ||
    ipv6Regex.test(cleanIP) ||
    ipv6CompressedRegex.test(cleanIP)
  );
}
