import { describe, it, expect } from "vitest";
import { getClientIP, isValidIP } from "../ip-utils";
import { NextRequest } from "next/server";

describe("getClientIP", () => {
  it("should extract IP from x-real-ip header", () => {
    const request = new NextRequest("http://localhost", {
      headers: {
        "x-real-ip": "192.168.1.1",
      },
    });

    expect(getClientIP(request)).toBe("192.168.1.1");
  });

  it("should extract first IP from x-forwarded-for header", () => {
    const request = new NextRequest("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      },
    });

    expect(getClientIP(request)).toBe("203.0.113.195");
  });

  it("should handle IPv6 addresses", () => {
    const request = new NextRequest("http://localhost", {
      headers: {
        "x-real-ip": "2001:db8::1",
      },
    });

    expect(getClientIP(request)).toBe("2001:db8::1");
  });

  it("should prioritize x-real-ip over x-forwarded-for", () => {
    const request = new NextRequest("http://localhost", {
      headers: {
        "x-real-ip": "192.168.1.1",
        "x-forwarded-for": "203.0.113.195",
      },
    });

    expect(getClientIP(request)).toBe("192.168.1.1");
  });

  it("should handle cf-connecting-ip for Cloudflare", () => {
    const request = new NextRequest("http://localhost", {
      headers: {
        "cf-connecting-ip": "192.168.1.100",
      },
    });

    expect(getClientIP(request)).toBe("192.168.1.100");
  });

  it("should return 'unknown' when no valid IP is found", () => {
    const request = new NextRequest("http://localhost");

    expect(getClientIP(request)).toBe("unknown");
  });

  it("should ignore invalid IP addresses", () => {
    const request = new NextRequest("http://localhost", {
      headers: {
        "x-forwarded-for": "invalid-ip, 192.168.1.1",
      },
    });

    expect(getClientIP(request)).toBe("192.168.1.1");
  });
});

describe("isValidIP", () => {
  it("should validate IPv4 addresses", () => {
    expect(isValidIP("192.168.1.1")).toBe(true);
    expect(isValidIP("10.0.0.1")).toBe(true);
    expect(isValidIP("203.0.113.195")).toBe(true);
    expect(isValidIP("127.0.0.1")).toBe(true);
  });

  it("should validate IPv6 addresses", () => {
    expect(isValidIP("2001:db8::1")).toBe(true);
    expect(isValidIP("::1")).toBe(true);
    expect(isValidIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
  });

  it("should reject invalid IP addresses", () => {
    expect(isValidIP("300.300.300.300")).toBe(false);
    expect(isValidIP("invalid-ip")).toBe(false);
    expect(isValidIP("")).toBe(false);
    expect(isValidIP("192.168.1")).toBe(false);
    expect(isValidIP("192.168.1.1.1")).toBe(false);
  });

  it("should handle edge cases", () => {
    expect(isValidIP("0.0.0.0")).toBe(true);
    expect(isValidIP("255.255.255.255")).toBe(true);
    expect(isValidIP("::")).toBe(true);
  });
});
