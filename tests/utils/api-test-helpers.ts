import { NextRequest } from "next/server";
import { generateAccessToken } from "@/lib/auth/jwt";
import { vi, expect } from "vitest";

/**
 * Helper to create a test NextRequest with proper headers and body
 */
export function createTestRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "GET", body, headers = {}, cookies = {} } = options;

  // Set default headers
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Convert cookies to header format
  if (Object.keys(cookies).length > 0) {
    defaultHeaders["Cookie"] = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  // Create request configuration
  const requestConfig: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: defaultHeaders,
  };

  // Only add body if it exists
  if (body !== undefined) {
    requestConfig.body = JSON.stringify(body);
  }

  // Create request
  const request = new NextRequest(url, requestConfig);

  return request;
}

/**
 * Helper to create a test user token
 */
export function createTestToken(user: {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "supporter" | "user";
  isActive?: boolean;
  emailVerified?: boolean;
  isSupporterFlag?: boolean;
}): string {
  return generateAccessToken({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive ?? true,
    emailVerified: user.emailVerified ?? true,
    isSupporterFlag: user.isSupporterFlag ?? false,
  });
}

/**
 * Helper to create an authenticated test request
 */
export function createAuthenticatedRequest(
  url: string,
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: "admin" | "supporter" | "user";
    isActive?: boolean;
    emailVerified?: boolean;
    isSupporterFlag?: boolean;
  },
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const token = createTestToken(user);

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  return createTestRequest(url, {
    ...options,
    headers,
  });
}

/**
 * Helper to parse JSON response from Response object
 */
export async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse JSON response: ${text}`);
  }
}

/**
 * Helper to create test user data
 */
export function createTestUser(
  overrides: Partial<{
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: "admin" | "supporter" | "user";
    isActive: boolean;
    emailVerified: boolean;
  }> = {}
) {
  return {
    id: 1,
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    role: "user" as const,
    isActive: true,
    emailVerified: true,
    ...overrides,
  };
}

/**
 * Helper to create test admin user
 */
export function createTestAdmin(
  overrides: Partial<{
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  }> = {}
) {
  return createTestUser({
    role: "admin" as const,
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    ...overrides,
  });
}

/**
 * Mock fetch for external API calls
 */
export function mockFetch(
  responses: Array<{
    url: string | RegExp;
    response: unknown;
    status?: number;
  }>
) {
  const originalFetch = global.fetch;

  global.fetch = vi.fn().mockImplementation((url: string) => {
    const matchingResponse = responses.find((r) =>
      typeof r.url === "string" ? url === r.url : r.url.test(url)
    );

    if (!matchingResponse) {
      throw new Error(`No mock response found for URL: ${url}`);
    }

    return Promise.resolve({
      ok: (matchingResponse.status ?? 200) < 400,
      status: matchingResponse.status ?? 200,
      json: () => Promise.resolve(matchingResponse.response),
      text: () => Promise.resolve(JSON.stringify(matchingResponse.response)),
    } as Response);
  });

  return () => {
    global.fetch = originalFetch;
  };
}

/**
 * Assert that response has expected status and structure
 */
export async function assertApiResponse<T = any>(
  response: Response,
  expectedStatus: number,
  assertions?: (data: T) => void
) {
  expect(response.status).toBe(expectedStatus);

  if (assertions) {
    const data = (await parseJsonResponse(response)) as T;
    assertions(data);
  }
}
