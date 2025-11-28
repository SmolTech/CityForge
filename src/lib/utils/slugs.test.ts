import { describe, test, expect } from "vitest";
import { generateSlug } from "./slugs";

describe("generateSlug", () => {
  test("should convert text to lowercase", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
    expect(generateSlug("UPPERCASE TEXT")).toBe("uppercase-text");
  });

  test("should replace spaces with hyphens", () => {
    expect(generateSlug("hello world")).toBe("hello-world");
    expect(generateSlug("multiple  spaces   here")).toBe(
      "multiple-spaces-here"
    );
  });

  test("should remove special characters", () => {
    expect(generateSlug("hello@world#test!")).toBe("helloworldtest");
    expect(generateSlug("test$%^&*()")).toBe("test");
    expect(generateSlug("café & bistro")).toBe("caf-bistro");
  });

  test("should handle hyphens correctly", () => {
    expect(generateSlug("hello-world")).toBe("hello-world");
    expect(generateSlug("test--multiple--hyphens")).toBe(
      "test-multiple-hyphens"
    );
    expect(generateSlug("-leading-and-trailing-")).toBe("leading-and-trailing");
  });

  test("should trim whitespace", () => {
    expect(generateSlug("  hello world  ")).toBe("hello-world");
    expect(generateSlug("\t\nhello\t\n")).toBe("hello");
  });

  test("should handle empty strings and whitespace-only strings", () => {
    expect(generateSlug("")).toBe("");
    expect(generateSlug("   ")).toBe("");
    expect(generateSlug("\t\n\r")).toBe("");
  });

  test("should handle numbers and underscores", () => {
    expect(generateSlug("hello_world_123")).toBe("hello_world_123");
    expect(generateSlug("test 123 abc")).toBe("test-123-abc");
  });

  test("should handle complex mixed cases", () => {
    expect(generateSlug("The Quick Brown Fox & Co.")).toBe(
      "the-quick-brown-fox-co"
    );
    expect(generateSlug("  --  Test  --  ")).toBe("test");
    expect(generateSlug("Forum Category (2024)")).toBe("forum-category-2024");
  });

  test("should handle unicode characters", () => {
    expect(generateSlug("résumé café")).toBe("rsum-caf");
    expect(generateSlug("naïve coöperation")).toBe("nave-coperation");
  });

  test("should handle very long strings", () => {
    const longText = "a".repeat(100) + " " + "b".repeat(100);
    const result = generateSlug(longText);
    expect(result).toBe("a".repeat(100) + "-" + "b".repeat(100));
  });
});
