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
  support?: boolean;
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
    support: user.support ?? false,
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
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const token = createTestToken(user);

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const requestOptions: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {
    headers,
  };

  if (options.method) {
    requestOptions.method = options.method;
  }

  if (options.body !== undefined) {
    requestOptions.body = options.body;
  }

  if (options.cookies) {
    requestOptions.cookies = options.cookies;
  }

  return createTestRequest(url, requestOptions);
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Helper to create a test NextRequest with FormData support (async version)
 * Use this for FormData uploads in Vitest environment
 */
export async function createTestRequestWithFormData(
  url: string,
  options: RequestInit & { body?: FormData }
): Promise<NextRequest> {
  console.log("Debug - Processing FormData for Vitest/jsdom environment");

  // Create headers object with proper typing
  const headers: Record<string, string> = {};

  if (options.headers) {
    if (options.headers instanceof Headers) {
      // Convert Headers object to Record<string, string>
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      // Convert array format to Record<string, string>
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      // Already an object, spread it
      Object.assign(headers, options.headers);
    }
  }

  if (options.body instanceof FormData) {
    const body = options.body;

    // Generate a boundary for the multipart form
    const boundary = `----formdata-vitest-${Math.random().toString(36).substring(2)}`;

    // Manually construct the multipart body
    let multipartBody = "";
    for (const [name, value] of body.entries()) {
      multipartBody += `--${boundary}\r\n`;

      if (value instanceof File) {
        multipartBody += `Content-Disposition: form-data; name="${name}"; filename="${value.name}"\r\n`;
        multipartBody += `Content-Type: ${value.type || "application/octet-stream"}\r\n\r\n`;
        // For test files, use predictable test content based on filename
        if (value.name && value.size > 0) {
          multipartBody += `test image content for ${value.name}`;
        } else {
          multipartBody += "";
        }
      } else {
        multipartBody += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
        multipartBody += String(value);
      }
      multipartBody += `\r\n`;
    }
    multipartBody += `--${boundary}--\r\n`;

    // Set the Content-Type header
    headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;

    console.log(
      `Debug - Applied FormData workaround with boundary: ${boundary}`
    );
    console.log(
      `Debug - Final request Content-Type: multipart/form-data; boundary=${boundary}`
    );

    // Create request with manual multipart body
    const requestOptions: Record<string, unknown> = {
      headers,
      body: multipartBody,
    };

    if (options.method) {
      requestOptions["method"] = options.method;
    }

    const request = new NextRequest(
      url,
      requestOptions as ConstructorParameters<typeof NextRequest>[1]
    );
    console.log(
      "Debug - Request headers:",
      Object.fromEntries(request.headers)
    );
    console.log("Debug - Content-Type:", request.headers.get("content-type"));
    return request;
  }

  // For non-FormData requests, use standard approach
  const requestOptions: Record<string, unknown> = {
    headers,
  };

  if (options.method) {
    requestOptions["method"] = options.method;
  }

  if (options.body) {
    requestOptions["body"] = options.body;
  }

  const request = new NextRequest(
    url,
    requestOptions as ConstructorParameters<typeof NextRequest>[1]
  );
  console.log("Debug - Request headers:", Object.fromEntries(request.headers));
  console.log("Debug - Content-Type:", request.headers.get("content-type"));
  return request;
}

/**
 * Helper to create an authenticated test request with FormData support
 */
export async function createAuthenticatedRequestWithFormData(
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
    body?: FormData;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): Promise<NextRequest> {
  const token = createTestToken(user);

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const requestOptions: {
    method?: string;
    body?: FormData;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {
    headers,
  };

  if (options.method) {
    requestOptions.method = options.method;
  }

  if (options.body !== undefined) {
    requestOptions.body = options.body;
  }

  if (options.cookies) {
    requestOptions.cookies = options.cookies;
  }

  return createTestRequestWithFormData(url, requestOptions);
}
