import { describe, it, expect } from "vitest";
import {
  getSearchResultLink,
  getPrimaryAction,
} from "@/lib/utils/search-links";

describe("Search Links Utilities", () => {
  describe("getSearchResultLink", () => {
    it("should generate internal link for Business Directory results", () => {
      const result = {
        id: 11,
        title: "Femme Bar",
        category: "Business Directory",
        url: "https://femmebar.com",
        page_url: "https://femmebar.com",
        domain: "femmebar.com",
      };

      const linkInfo = getSearchResultLink(result);

      expect(linkInfo).toEqual({
        internalUrl: "/business/11/femme-bar",
        externalUrl: "https://femmebar.com",
        linkText: "Femme Bar",
        isInternal: true,
      });
    });

    it("should handle business names with special characters", () => {
      const result = {
        id: 123,
        title: "Joe's Pizza & Grill (Downtown)",
        category: "Business Directory",
        url: "https://joespizza.com",
        page_url: "https://joespizza.com",
        domain: "joespizza.com",
      };

      const linkInfo = getSearchResultLink(result);

      expect(linkInfo).toEqual({
        internalUrl: "/business/123/joe-s-pizza-grill-downtown",
        externalUrl: "https://joespizza.com",
        linkText: "Joe's Pizza & Grill (Downtown)",
        isInternal: true,
      });
    });

    it("should generate external link for non-Business Directory results", () => {
      const result = {
        id: 456,
        title: "External News Article",
        category: "News & Media",
        url: "https://news.example.com/article",
        page_url: "https://news.example.com/article",
        domain: "news.example.com",
      };

      const linkInfo = getSearchResultLink(result);

      expect(linkInfo).toEqual({
        internalUrl: null,
        externalUrl: "https://news.example.com/article",
        linkText: "news.example.com",
        isInternal: false,
      });
    });

    it("should handle resources page internal links", () => {
      const result = {
        id: 0,
        title: "Resources Directory",
        category: "Community Resources",
        url: "https://community.community/resources",
        page_url: "https://community.community/resources",
        domain: "community.community",
      };

      const linkInfo = getSearchResultLink(result);

      expect(linkInfo).toEqual({
        internalUrl: "/resources",
        externalUrl: "https://community.community/resources",
        linkText: "Resources Directory",
        isInternal: true,
      });
    });

    it("should handle forum links", () => {
      const result = {
        id: 0,
        title: "Discussion about local events",
        category: "Forums",
        url: "https://community.community/forums/general/123",
        page_url: "https://community.community/forums/general/123",
        domain: "community.community",
      };

      const linkInfo = getSearchResultLink(result);

      expect(linkInfo).toEqual({
        internalUrl: "/forums/general/123",
        externalUrl: "https://community.community/forums/general/123",
        linkText: "Discussion about local events",
        isInternal: true,
      });
    });

    it("should handle invalid input gracefully", () => {
      const invalidResult = null;

      const linkInfo = getSearchResultLink(invalidResult as any);

      expect(linkInfo).toEqual({
        internalUrl: null,
        externalUrl: "#",
        linkText: "Invalid result",
        isInternal: false,
      });
    });

    it("should handle missing required properties", () => {
      const incompleteResult = {
        id: "invalid", // Wrong type
        title: null, // Wrong type
        category: undefined,
        url: "",
        page_url: "",
        domain: "",
      };

      const linkInfo = getSearchResultLink(incompleteResult as any);

      expect(linkInfo).toEqual({
        internalUrl: null,
        externalUrl: "#",
        linkText: "Unknown site",
        isInternal: false,
      });
    });

    it("should fallback to url when page_url is missing", () => {
      const result = {
        id: 789,
        title: "Test Business",
        category: "Business Directory",
        url: "https://testbusiness.com",
        page_url: "",
        domain: "testbusiness.com",
      };

      const linkInfo = getSearchResultLink(result);

      expect(linkInfo).toEqual({
        internalUrl: "/business/789/test-business",
        externalUrl: "https://testbusiness.com",
        linkText: "Test Business",
        isInternal: true,
      });
    });
  });

  describe("getPrimaryAction", () => {
    it("should return internal action for Business Directory results", () => {
      const result = {
        id: 11,
        title: "Femme Bar",
        category: "Business Directory",
        url: "https://femmebar.com",
        page_url: "https://femmebar.com",
        domain: "femmebar.com",
      };

      const action = getPrimaryAction(result);

      expect(action).toEqual({
        type: "internal",
        url: "/business/11/femme-bar",
      });
    });

    it("should return external action for non-Business Directory results", () => {
      const result = {
        id: 456,
        title: "External Website",
        category: "Other",
        url: "https://example.com",
        page_url: "https://example.com/page",
        domain: "example.com",
      };

      const action = getPrimaryAction(result);

      expect(action).toEqual({
        type: "external",
        url: "https://example.com/page",
      });
    });

    it("should return external action when internal URL generation fails", () => {
      const result = {
        id: 0, // Invalid ID for Business Directory
        title: "Invalid Business",
        category: "Business Directory",
        url: "https://business.com",
        page_url: "https://business.com",
        domain: "business.com",
      };

      const action = getPrimaryAction(result);

      expect(action).toEqual({
        type: "external",
        url: "https://business.com",
      });
    });
  });
});
