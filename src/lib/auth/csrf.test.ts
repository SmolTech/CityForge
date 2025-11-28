import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  generateCsrfToken,
  validateCsrfToken,
  isCsrfExempt,
  withCsrfProtection,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from "./csrf";

describe("CSRF Protection", () => {
  describe("generateCsrfToken", () => {
    it("should generate a valid token", () => {
      const token = generateCsrfToken();
      expect(token).toBeTruthy();
      expect(token).toMatch(/^[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
    });

    it("should generate unique tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("validateCsrfToken", () => {
    it("should return true when cookie and header tokens match", () => {
      const token = generateCsrfToken();
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          cookie: `${CSRF_COOKIE_NAME}=${token}`,
          [CSRF_HEADER_NAME]: token,
        },
      });

      expect(validateCsrfToken(request)).toBe(true);
    });

    it("should return false when tokens don't match", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          cookie: `${CSRF_COOKIE_NAME}=${token1}`,
          [CSRF_HEADER_NAME]: token2,
        },
      });

      expect(validateCsrfToken(request)).toBe(false);
    });

    it("should return false when cookie is missing", () => {
      const token = generateCsrfToken();
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          [CSRF_HEADER_NAME]: token,
        },
      });

      expect(validateCsrfToken(request)).toBe(false);
    });

    it("should return false when header is missing", () => {
      const token = generateCsrfToken();
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          cookie: `${CSRF_COOKIE_NAME}=${token}`,
        },
      });

      expect(validateCsrfToken(request)).toBe(false);
    });

    it("should return false when both are missing", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
      });

      expect(validateCsrfToken(request)).toBe(false);
    });
  });

  describe("isCsrfExempt", () => {
    it("should exempt GET requests", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
      });
      expect(isCsrfExempt(request)).toBe(true);
    });

    it("should exempt HEAD requests", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "HEAD",
      });
      expect(isCsrfExempt(request)).toBe(true);
    });

    it("should exempt OPTIONS requests", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "OPTIONS",
      });
      expect(isCsrfExempt(request)).toBe(true);
    });

    it("should exempt requests with Bearer token", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          Authorization: "Bearer some-token",
        },
      });
      expect(isCsrfExempt(request)).toBe(true);
    });

    it("should not exempt POST requests without Bearer token", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
      });
      expect(isCsrfExempt(request)).toBe(false);
    });

    it("should not exempt PUT requests without Bearer token", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "PUT",
      });
      expect(isCsrfExempt(request)).toBe(false);
    });

    it("should not exempt DELETE requests without Bearer token", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "DELETE",
      });
      expect(isCsrfExempt(request)).toBe(false);
    });
  });

  describe("withCsrfProtection middleware", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mockHandler = async (request: NextRequest) => {
      return NextResponse.json({ success: true });
    };

    it("should allow exempt requests without CSRF token", async () => {
      const protectedHandler = withCsrfProtection(mockHandler);
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
      });

      const response = await protectedHandler(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true });
    });

    it("should allow Bearer token requests without CSRF token", async () => {
      const protectedHandler = withCsrfProtection(mockHandler);
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          Authorization: "Bearer some-token",
        },
      });

      const response = await protectedHandler(request);
      expect(response.status).toBe(200);
    });

    it("should allow POST requests with valid CSRF token", async () => {
      const protectedHandler = withCsrfProtection(mockHandler);
      const token = generateCsrfToken();
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          cookie: `${CSRF_COOKIE_NAME}=${token}`,
          [CSRF_HEADER_NAME]: token,
        },
      });

      const response = await protectedHandler(request);
      expect(response.status).toBe(200);
    });

    it("should reject POST requests with invalid CSRF token", async () => {
      const protectedHandler = withCsrfProtection(mockHandler);
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          cookie: `${CSRF_COOKIE_NAME}=${generateCsrfToken()}`,
          [CSRF_HEADER_NAME]: generateCsrfToken(),
        },
      });

      const response = await protectedHandler(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("CSRF_TOKEN_INVALID");
    });

    it("should reject POST requests without CSRF token", async () => {
      const protectedHandler = withCsrfProtection(mockHandler);
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
      });

      const response = await protectedHandler(request);
      expect(response.status).toBe(403);
    });

    it("should reject PUT requests without CSRF token", async () => {
      const protectedHandler = withCsrfProtection(mockHandler);
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "PUT",
      });

      const response = await protectedHandler(request);
      expect(response.status).toBe(403);
    });

    it("should reject DELETE requests without CSRF token", async () => {
      const protectedHandler = withCsrfProtection(mockHandler);
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "DELETE",
      });

      const response = await protectedHandler(request);
      expect(response.status).toBe(403);
    });
  });
});
