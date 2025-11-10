// Rate limiting storage (in-memory for now)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check if a user is within rate limit
 * @param userId User ID
 * @param limitKey Unique identifier for the rate limit type (e.g., "post-creation", "thread-creation")
 * @param limitPerHour Maximum requests per hour
 * @returns true if within limit, false if exceeded
 */
export function checkRateLimit(
  userId: number,
  limitKey: string,
  limitPerHour: number
): boolean {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;
  const key = `${userId}:${limitKey}`;

  const userLimits = rateLimitStore.get(key);

  // If no record exists or the hour has passed, reset
  if (!userLimits || now >= userLimits.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + hourInMs });
    return true;
  }

  // Check if under the limit
  if (userLimits.count >= limitPerHour) {
    return false;
  }

  // Increment count
  userLimits.count += 1;
  return true;
}

/**
 * Create a rate limit error response
 */
export function createRateLimitResponse(limitDescription: string) {
  return {
    error: {
      message: "Rate limit exceeded. Please try again later.",
      code: 429,
      details: {
        description: limitDescription,
      },
    },
  };
}
