/**
 * Simple in-memory cache for API responses
 * Helps reduce database queries for frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxSize = 1000; // Prevent memory bloat

  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    // Clear old entries if cache is getting too large
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): number {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  size(): number {
    return this.cache.size;
  }

  // Generate cache key from request parameters
  static generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join("|");

    return `${prefix}:${sortedParams}`;
  }
}

// Global cache instance
export const apiCache = new SimpleCache();

// Cleanup expired entries every 5 minutes
if (typeof window === "undefined") {
  // Server-side only
  setInterval(
    () => {
      const deleted = apiCache.cleanup();
      if (deleted > 0 && process.env.NODE_ENV === "development") {
        console.log(`Cache cleanup: removed ${deleted} expired entries`);
      }
    },
    5 * 60 * 1000
  );
}

// Helper function to wrap API functions with caching
export function withCache<T>(
  cacheKey: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = apiCache.get<T>(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  return fn().then((result) => {
    apiCache.set(cacheKey, result, ttlSeconds);
    return result;
  });
}
