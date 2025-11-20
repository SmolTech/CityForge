import crypto from "crypto";

/**
 * Generate a cryptographically secure random token
 * @param length - Length of the token in bytes (default 32)
 * @returns Hex-encoded token string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash a token for secure storage
 * @param token - The token to hash
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
