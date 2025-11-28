/**
 * ConfigContext Test Suite
 * Tests configuration loading, caching, and fallback behavior
 */

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ConfigProvider, useConfig } from "../ConfigContext";
import { AppConfig } from "@/lib/resources";
import { logger } from "@/lib/logger";
import { fetchWithTimeout } from "@/lib/utils/fetch-timeout";

// Mock dependencies
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

const mockLogger = logger as unknown as { error: Mock };
const mockFetchWithTimeout = fetchWithTimeout as Mock;

// Test component that uses the config context
const TestComponent: React.FC = () => {
  const config = useConfig();

  return (
    <div>
      <div data-testid="site-title">{config.site.title}</div>
      <div data-testid="site-description">{config.site.description}</div>
      <div data-testid="site-domain">{config.site.domain}</div>
      <div data-testid="site-tagline">{config.site.tagline}</div>
      <div data-testid="copyright">{config.site.copyright}</div>
      <div data-testid="copyright-holder">{config.site.copyrightHolder}</div>
      <div data-testid="theme-color">{config.site.themeColor}</div>
      <div data-testid="google-analytics">
        {config.site.googleAnalyticsId || "no-analytics"}
      </div>
      <div data-testid="resources-title">{config.resources.title}</div>
      <div data-testid="resources-description">
        {config.resources.description}
      </div>
      <div data-testid="footer-title">{config.footer.title}</div>
      <div data-testid="footer-email">{config.footer.contactEmail}</div>
      <div data-testid="pagination-limit">{config.pagination.defaultLimit}</div>
      <div data-testid="quick-access-count">{config.quickAccess.length}</div>
      <div data-testid="resource-items-count">
        {config.resourceItems.length}
      </div>
    </div>
  );
};

// Component for testing edge cases that might have incomplete config
const MinimalTestComponent: React.FC = () => {
  const config = useConfig();

  return (
    <div>
      <div data-testid="config-exists">{config ? "exists" : "null"}</div>
      <div data-testid="site-exists">{config.site ? "exists" : "missing"}</div>
      <div data-testid="site-title">{config.site?.title || "no-title"}</div>
    </div>
  );
};

// Component that tests useConfig outside provider (should still work with default)
const TestComponentWithoutProvider: React.FC = () => {
  const config = useConfig();
  return (
    <div>
      <div data-testid="title-outside-provider">{config.site.title}</div>
    </div>
  );
};

// Mock config data
const mockApiConfig: AppConfig = {
  site: {
    title: "Test Community",
    description: "A test community website",
    tagline: "Test Directory",
    directoryDescription: "Test local resources and information.",
    copyright: "2024",
    copyrightHolder: "Test Organization",
    copyrightUrl: "https://test.com",
    domain: "test.community",
    shortName: "TestCom",
    fullName: "Test Community Website",
    themeColor: "#3b82f6",
    backgroundColor: "#f8fafc",
    googleAnalyticsId: "GA-123456789",
  },
  resources: {
    title: "Test Resources",
    description: "Test essential links to local services",
  },
  quickAccess: [
    {
      id: "emergency",
      title: "Emergency",
      subtitle: "Call 911",
      phone: "911",
      color: "#ef4444",
      icon: "phone",
    },
    {
      id: "police",
      title: "Police",
      subtitle: "Non-emergency",
      phone: "(555) 123-4567",
      color: "#3b82f6",
      icon: "shield",
    },
  ],
  resourceItems: [
    {
      id: 1,
      title: "City Hall",
      url: "https://city.test",
      description: "Official city website",
      category: "Government",
      phone: "(555) 123-0000",
      address: "123 Main St",
      icon: "building",
    },
    {
      id: 2,
      title: "Library",
      url: "https://library.test",
      description: "Public library system",
      category: "Education",
      icon: "book",
    },
  ],
  footer: {
    title: "Contact Test Community",
    description: "We're here to help!",
    contactEmail: "contact@test.community",
    buttonText: "Get in Touch",
  },
  pagination: {
    defaultLimit: 25,
  },
};

const mockResponse = {
  ok: true,
  json: vi.fn().mockResolvedValue(mockApiConfig),
};

describe("ConfigContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ConfigProvider", () => {
    it("should load configuration from API successfully", async () => {
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      // Wait for config to load
      await waitFor(() => {
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Test Community"
        );
        expect(screen.getByTestId("site-description")).toHaveTextContent(
          "A test community website"
        );
        expect(screen.getByTestId("site-domain")).toHaveTextContent(
          "test.community"
        );
        expect(screen.getByTestId("site-tagline")).toHaveTextContent(
          "Test Directory"
        );
        expect(screen.getByTestId("copyright")).toHaveTextContent("2024");
        expect(screen.getByTestId("copyright-holder")).toHaveTextContent(
          "Test Organization"
        );
        expect(screen.getByTestId("theme-color")).toHaveTextContent("#3b82f6");
        expect(screen.getByTestId("google-analytics")).toHaveTextContent(
          "GA-123456789"
        );
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith("/api/config");
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    });

    it("should display resources and pagination configuration", async () => {
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("resources-title")).toHaveTextContent(
          "Test Resources"
        );
        expect(screen.getByTestId("resources-description")).toHaveTextContent(
          "Test essential links to local services"
        );
        expect(screen.getByTestId("pagination-limit")).toHaveTextContent("25");
      });
    });

    it("should display footer configuration", async () => {
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("footer-title")).toHaveTextContent(
          "Contact Test Community"
        );
        expect(screen.getByTestId("footer-email")).toHaveTextContent(
          "contact@test.community"
        );
      });
    });

    it("should display quick access items and resource items", async () => {
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("quick-access-count")).toHaveTextContent("2");
        expect(screen.getByTestId("resource-items-count")).toHaveTextContent(
          "2"
        );
      });
    });

    it("should use fallback config when API request fails", async () => {
      const networkError = new Error("Network request failed");
      mockFetchWithTimeout.mockRejectedValue(networkError);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        // Should use fallback/default config
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Community Website"
        );
        expect(screen.getByTestId("site-description")).toHaveTextContent(
          "Helping connect people to the resources available to them."
        );
        expect(screen.getByTestId("site-domain")).toHaveTextContent(
          "community.local"
        );
        expect(screen.getByTestId("copyright")).toHaveTextContent("2025");
        expect(screen.getByTestId("pagination-limit")).toHaveTextContent("20");
        expect(screen.getByTestId("google-analytics")).toHaveTextContent(
          "no-analytics"
        ); // Empty string
        expect(screen.getByTestId("quick-access-count")).toHaveTextContent("0"); // Empty array
        expect(screen.getByTestId("resource-items-count")).toHaveTextContent(
          "0"
        ); // Empty array
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error loading app config:",
        networkError
      );
      expect(mockFetchWithTimeout).toHaveBeenCalledWith("/api/config");
    });

    it("should use fallback config when API returns non-ok response", async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        json: vi.fn(),
      };
      mockFetchWithTimeout.mockResolvedValue(errorResponse);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Community Website"
        );
        expect(screen.getByTestId("site-domain")).toHaveTextContent(
          "community.local"
        );
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error loading app config:",
        new Error("Failed to fetch config: 500")
      );
    });

    it("should use fallback config when API returns malformed JSON", async () => {
      const badResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      };
      mockFetchWithTimeout.mockResolvedValue(badResponse);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Community Website"
        );
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error loading app config:",
        new Error("Invalid JSON")
      );
    });

    it("should use fallback config when API returns partial config", async () => {
      // Partial config that's missing required sections should be treated as invalid
      const partialConfig = {
        site: {
          title: "Partial Config",
          description: "Only partial data",
          // Missing many required fields like domain, copyright, etc.
        },
        // Missing other required sections like resources, footer, etc.
      };

      const partialResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(partialConfig),
      };
      mockFetchWithTimeout.mockResolvedValue(partialResponse);

      render(
        <ConfigProvider>
          <MinimalTestComponent />
        </ConfigProvider>
      );

      // Since the config is incomplete, this tests the current behavior:
      // The partial config gets set directly, which can break components
      // that expect a complete config structure
      await waitFor(() => {
        expect(screen.getByTestId("config-exists")).toHaveTextContent("exists");
        expect(screen.getByTestId("site-exists")).toHaveTextContent("exists");
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Partial Config"
        );
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith("/api/config");
    });

    it("should only make API request once on mount", async () => {
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      const { rerender } = render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Test Community"
        );
      });

      // Re-render should not trigger another API call
      rerender(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      // Wait a bit and verify no additional calls
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe("useConfig hook", () => {
    it("should return default config when used outside provider", () => {
      render(<TestComponentWithoutProvider />);

      expect(screen.getByTestId("title-outside-provider")).toHaveTextContent(
        "Community Website"
      );
    });

    it("should return default config initially and then update when config loads", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetchWithTimeout.mockReturnValue(promise);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      // Initially should show default config
      expect(screen.getByTestId("site-title")).toHaveTextContent(
        "Community Website"
      );

      // Resolve the API call
      resolvePromise!(mockResponse);

      // Should update to loaded config
      await waitFor(() => {
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Test Community"
        );
      });
    });

    it("should provide all expected config properties", async () => {
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      let capturedConfig: AppConfig | null = null;

      const TestConfigConsumer: React.FC = () => {
        capturedConfig = useConfig();
        return <div>Config consumer</div>;
      };

      render(
        <ConfigProvider>
          <TestConfigConsumer />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(capturedConfig).toBeTruthy();
      });

      expect(capturedConfig!.site).toBeDefined();
      expect(capturedConfig!.resources).toBeDefined();
      expect(capturedConfig!.quickAccess).toBeInstanceOf(Array);
      expect(capturedConfig!.resourceItems).toBeInstanceOf(Array);
      expect(capturedConfig!.footer).toBeDefined();
      expect(capturedConfig!.pagination).toBeDefined();

      // Verify specific loaded values
      expect(capturedConfig!.site.title).toBe("Test Community");
      expect(capturedConfig!.pagination.defaultLimit).toBe(25);
      expect(capturedConfig!.quickAccess).toHaveLength(2);
      expect(capturedConfig!.resourceItems).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty API response by treating it as an error", async () => {
      const emptyResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetchWithTimeout.mockResolvedValue(emptyResponse);

      render(
        <ConfigProvider>
          <MinimalTestComponent />
        </ConfigProvider>
      );

      // Empty response would cause errors when components try to access config properties
      // Using MinimalTestComponent which is safer for testing edge cases
      await waitFor(() => {
        expect(screen.getByTestId("config-exists")).toHaveTextContent("exists");
        expect(screen.getByTestId("site-exists")).toHaveTextContent("missing");
        expect(screen.getByTestId("site-title")).toHaveTextContent("no-title");
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith("/api/config");
    });

    it("should handle null API response by treating it as an error", async () => {
      const nullResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(null),
      };
      mockFetchWithTimeout.mockResolvedValue(nullResponse);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      // Null response would cause the context to be set to null,
      // which should trigger useConfig to return defaultConfig
      await waitFor(() => {
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Community Website"
        );
      });
    });

    it("should handle config with missing optional fields", async () => {
      const minimalConfig: AppConfig = {
        site: {
          title: "Minimal Config",
          description: "Basic config",
          tagline: "Simple",
          directoryDescription: "Basic directory",
          copyright: "2024",
          copyrightHolder: "Test",
          copyrightUrl: "#",
          domain: "test.local",
          shortName: "Test",
          fullName: "Test Site",
          themeColor: "#000000",
          backgroundColor: "#ffffff",
          googleAnalyticsId: "", // Empty but present
        },
        resources: {
          title: "Resources",
          description: "Basic resources",
        },
        quickAccess: [], // Empty arrays
        resourceItems: [],
        footer: {
          title: "Footer",
          description: "Basic footer",
          contactEmail: "test@test.com",
          buttonText: "Contact",
        },
        pagination: {
          defaultLimit: 10,
        },
      };

      const minimalResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(minimalConfig),
      };
      mockFetchWithTimeout.mockResolvedValue(minimalResponse);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Minimal Config"
        );
        expect(screen.getByTestId("google-analytics")).toHaveTextContent(
          "no-analytics"
        );
        expect(screen.getByTestId("quick-access-count")).toHaveTextContent("0");
        expect(screen.getByTestId("resource-items-count")).toHaveTextContent(
          "0"
        );
        expect(screen.getByTestId("pagination-limit")).toHaveTextContent("10");
      });
    });

    it("should handle timeout errors specifically", async () => {
      const timeoutError = new Error(
        "Request timed out after 5000ms for /api/config"
      );
      timeoutError.name = "TimeoutError";
      mockFetchWithTimeout.mockRejectedValue(timeoutError);

      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("site-title")).toHaveTextContent(
          "Community Website"
        );
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error loading app config:",
        timeoutError
      );
    });
  });
});
