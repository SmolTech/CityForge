/**
 * Pagination constants for consistent query limits across the application
 * These help prevent potential DoS attacks via unbounded database queries
 */

// Maximum limits for different resource types
export const PAGINATION_LIMITS = {
  // Main content limits
  CARDS_MAX_LIMIT: 100,
  CARDS_DEFAULT_LIMIT: 20,

  // User-generated content limits
  REVIEWS_MAX_LIMIT: 50,
  REVIEWS_DEFAULT_LIMIT: 10,

  // Administrative limits
  USERS_MAX_LIMIT: 100,
  USERS_DEFAULT_LIMIT: 50,

  // Search and discovery limits
  SEARCH_MAX_LIMIT: 100,
  SEARCH_DEFAULT_LIMIT: 20,

  // Configuration and metadata limits (smaller datasets)
  TAGS_MAX_LIMIT: 200,
  TAGS_DEFAULT_LIMIT: 100,

  RESOURCE_CATEGORIES_MAX_LIMIT: 50,
  RESOURCE_CATEGORIES_DEFAULT_LIMIT: 25,

  RESOURCE_ITEMS_MAX_LIMIT: 200,
  RESOURCE_ITEMS_DEFAULT_LIMIT: 100,

  QUICK_ACCESS_MAX_LIMIT: 25,
  QUICK_ACCESS_DEFAULT_LIMIT: 15,

  // Forum limits
  FORUM_CATEGORIES_MAX_LIMIT: 50,
  FORUM_CATEGORIES_DEFAULT_LIMIT: 25,

  FORUM_THREADS_MAX_LIMIT: 100,
  FORUM_THREADS_DEFAULT_LIMIT: 20,

  FORUM_POSTS_MAX_LIMIT: 100,
  FORUM_POSTS_DEFAULT_LIMIT: 25,
} as const;

// Utility functions for pagination parameter validation
export const paginationUtils = {
  /**
   * Validate and clamp limit parameter
   */
  validateLimit(
    limit: string | number | null | undefined,
    maxLimit: number,
    defaultLimit: number
  ): number {
    const parsedLimit = typeof limit === "string" ? parseInt(limit, 10) : limit;

    if (!parsedLimit || isNaN(parsedLimit) || parsedLimit <= 0) {
      return defaultLimit;
    }

    return Math.min(parsedLimit, maxLimit);
  },

  /**
   * Validate and clamp offset parameter
   */
  validateOffset(offset: string | number | null | undefined): number {
    const parsedOffset =
      typeof offset === "string" ? parseInt(offset, 10) : offset;

    if (!parsedOffset || isNaN(parsedOffset) || parsedOffset < 0) {
      return 0;
    }

    return parsedOffset;
  },

  /**
   * Parse pagination parameters from URL search params
   */
  parseFromSearchParams(
    searchParams: URLSearchParams,
    maxLimit: number,
    defaultLimit: number
  ): { limit: number; offset: number } {
    const limit = this.validateLimit(
      searchParams.get("limit"),
      maxLimit,
      defaultLimit
    );

    const offset = this.validateOffset(searchParams.get("offset"));

    return { limit, offset };
  },

  /**
   * Calculate pagination metadata for responses
   */
  calculatePaginationMeta(
    total: number,
    limit: number,
    offset: number
  ): {
    total: number;
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return {
      total,
      limit,
      offset,
      totalPages,
      currentPage,
      hasNext: offset + limit < total,
      hasPrev: offset > 0,
    };
  },
} as const;

// Type definitions for pagination responses
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// Common pagination query parameters type
export interface PaginationParams {
  limit?: number;
  offset?: number;
}
