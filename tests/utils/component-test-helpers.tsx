import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { User } from "@/lib/api/types";

// Type definitions for better TypeScript support
interface MockRouterMethods {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
}

interface MockRouter extends MockRouterMethods {
  query: Record<string, string>;
  pathname: string;
}

/**
 * Helper to create a mock Next.js router for component testing
 */
export function createMockRouter(
  overrides: Partial<MockRouter> = {}
): MockRouter {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    query: {},
    pathname: "/",
    ...overrides,
  };
}

// Mock router state for component tests
let defaultRouter = createMockRouter();

/**
 * Mock Next.js router for component tests
 */
export function mockUseRouter(routerOverrides = {}) {
  defaultRouter = createMockRouter(routerOverrides);

  vi.mock("next/navigation", () => ({
    useRouter: vi.fn(() => defaultRouter),
    usePathname: vi.fn(() => defaultRouter.pathname),
    useSearchParams: vi.fn(() => new URLSearchParams()),
  }));

  return defaultRouter;
}

/**
 * Helper to mock fetch responses for component tests
 */
export function mockFetchResponses(
  responses: Array<{
    url: string | RegExp;
    response: unknown;
    status?: number;
    headers?: Record<string, string>;
  }>
) {
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    const matchingResponse = responses.find((r) =>
      typeof r.url === "string"
        ? url.includes(r.url) || url === r.url
        : r.url.test(url)
    );

    if (!matchingResponse) {
      throw new Error(`No mock response found for URL: ${url}`);
    }

    const response = {
      ok: (matchingResponse.status ?? 200) < 400,
      status: matchingResponse.status ?? 200,
      statusText: matchingResponse.status === 200 ? "OK" : "Error",
      headers: new Headers(matchingResponse.headers || {}),
      json: async () => matchingResponse.response,
      text: async () => JSON.stringify(matchingResponse.response),
    };

    return response;
  });
}

/**
 * Mock AuthContext for testing
 */
const MockAuthContext = React.createContext({
  user: null as User | null,
  loading: false,
  error: null,
  refreshUser: vi.fn(),
  isAuthenticated: false,
  isEmailVerified: false,
});

/**
 * Helper to create a mock authentication context provider
 */
export function createMockAuthProvider(user: User | null = null) {
  const mockAuthValue = {
    user,
    loading: false,
    error: null,
    refreshUser: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: !!user,
    isEmailVerified: user?.email_verified ?? false,
  };

  const MockAuthProvider = ({ children }: { children: React.ReactNode }) => (
    <MockAuthContext.Provider value={mockAuthValue}>
      {children}
    </MockAuthContext.Provider>
  );
  MockAuthProvider.displayName = "MockAuthProvider";

  return MockAuthProvider;
}

/**
 * Mock ConfigContext for testing
 */
const MockConfigContext = React.createContext({
  site: {
    title: "Test Site",
    description: "Test Description",
    copyright: "Test Copyright",
  },
  resources: { categories: [], items: [] },
  quickAccess: [],
  footer: { links: [] },
  pagination: { defaultLimit: 20 },
});

/**
 * Helper to create a mock configuration context provider
 */
export function createMockConfigProvider(config: Record<string, unknown> = {}) {
  const defaultConfig = {
    site: {
      title: "Test Site",
      description: "Test Description",
      copyright: "Test Copyright",
    },
    resources: {
      categories: [],
      items: [],
    },
    quickAccess: [],
    footer: {
      links: [],
    },
    pagination: {
      defaultLimit: 20,
    },
    ...config,
  };

  const MockConfigProvider = ({ children }: { children: React.ReactNode }) => (
    <MockConfigContext.Provider value={defaultConfig}>
      {children}
    </MockConfigContext.Provider>
  );
  MockConfigProvider.displayName = "MockConfigProvider";

  return MockConfigProvider;
}

/**
 * Helper to render component with all necessary providers
 */
export function renderWithProviders(
  component: React.ReactElement,
  options: {
    user?: User | null;
    config?: Record<string, unknown>;
    router?: Partial<MockRouter>;
  } = {}
) {
  const { user = null, config = {}, router = createMockRouter() } = options;

  // Mock the router
  const mockRouter = mockUseRouter(router);

  // Create providers
  const AuthProvider = createMockAuthProvider(user);
  const ConfigProvider = createMockConfigProvider(config);

  // Render with providers
  const result = render(component, {
    wrapper: ({ children }) => (
      <ConfigProvider>
        <AuthProvider>{children}</AuthProvider>
      </ConfigProvider>
    ),
  });

  return {
    ...result,
    mockRouter,
  };
}

/**
 * Helper to wait for API calls to complete
 */
export async function waitForApiCalls() {
  await waitFor(
    () => {
      // Wait for any pending promises/timers
    },
    { timeout: 1000 }
  );
}

/**
 * Helper to simulate user interactions
 */
export function createUserInteractions() {
  return {
    clickButton: async (text: string | RegExp) => {
      const button = screen.getByRole("button", { name: text });
      await userEvent.click(button);
    },

    clickLink: async (text: string | RegExp) => {
      const link = screen.getByRole("link", { name: text });
      await userEvent.click(link);
    },

    fillInput: async (labelText: string | RegExp, value: string) => {
      const input = screen.getByLabelText(labelText);
      await userEvent.clear(input);
      await userEvent.type(input, value);
    },

    selectOption: async (labelText: string | RegExp, option: string) => {
      const select = screen.getByLabelText(labelText);
      await userEvent.selectOptions(select, option);
    },

    submitForm: async (formName: string = "form") => {
      const form = screen.getByRole("form", { name: formName });
      fireEvent.submit(form);
    },
  };
}

/**
 * Helper to clean up after component tests
 */
export function cleanupComponentTest() {
  vi.clearAllMocks();
  vi.resetModules();
}
