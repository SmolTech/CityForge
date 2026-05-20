import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

class CacheManager {
  private readonly keyPrefix = "@CityForge:cache:";

  /**
   * Store data in cache with expiration
   */
  async set<T>(
    key: string,
    data: T,
    expiresIn: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<void> {
    try {
      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresIn,
      };

      const cacheKey = this.keyPrefix + key;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      logger.debug(`Cached data for key: ${key}`);
    } catch (error) {
      logger.error("Error storing cache:", error);
    }
  }

  /**
   * Get data from cache if not expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.keyPrefix + key;
      const cached = await AsyncStorage.getItem(cacheKey);

      if (!cached) {
        return null;
      }

      const cacheEntry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();

      // Check if expired
      if (now - cacheEntry.timestamp > cacheEntry.expiresIn) {
        await this.remove(key);
        logger.debug(`Cache expired for key: ${key}`);
        return null;
      }

      logger.debug(`Cache hit for key: ${key}`);
      return cacheEntry.data;
    } catch (error) {
      logger.error("Error reading cache:", error);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   */
  async remove(key: string): Promise<void> {
    try {
      const cacheKey = this.keyPrefix + key;
      await AsyncStorage.removeItem(cacheKey);
      logger.debug(`Removed cache for key: ${key}`);
    } catch (error) {
      logger.error("Error removing cache:", error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(this.keyPrefix));
      await AsyncStorage.multiRemove(cacheKeys);
      logger.debug(`Cleared ${cacheKeys.length} cache entries`);
    } catch (error) {
      logger.error("Error clearing cache:", error);
    }
  }

  /**
   * Check if data exists in cache (regardless of expiration)
   */
  async has(key: string): Promise<boolean> {
    try {
      const cacheKey = this.keyPrefix + key;
      const cached = await AsyncStorage.getItem(cacheKey);
      return cached !== null;
    } catch (error) {
      logger.error("Error checking cache:", error);
      return false;
    }
  }

  /**
   * Get cache size in bytes (approximate)
   */
  async getSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(this.keyPrefix));
      let totalSize = 0;

      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }

      return totalSize;
    } catch (error) {
      logger.error("Error calculating cache size:", error);
      return 0;
    }
  }
}

export const cacheManager = new CacheManager();
