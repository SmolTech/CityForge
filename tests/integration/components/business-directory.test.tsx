import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithProviders,
  mockFetchResponses,
  cleanupComponentTest,
} from "../../utils/component-test-helpers";
import Home from "../../../src/app/page";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

interface Tag {
  name: string;
}

interface TagCloudProps {
  tags: Tag[];
  onTagClick: (name: string) => void;
}

interface FilterPanelProps {
  onFeaturedChange: (featured: boolean) => void;
  onTagRemove: (tag: string) => void;
  selectedTags: string[];
}

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

interface NavigationProps {
  currentPage: string;
  siteTitle: string;
}

// Mock the components that aren't needed for the test
vi.mock("@/components/cards", () => ({
  Card: ({ card }: { card: { name: string } }) => (
    <div data-testid="business-card">{card.name}</div>
  ),
}));

vi.mock("@/components/search", () => ({
  SearchBar: ({ value, onChange, placeholder }: SearchBarProps) => (
    <input
      data-testid="search-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

vi.mock("@/components/filters", () => ({
  TagCloud: ({ tags, onTagClick }: TagCloudProps) => (
    <div data-testid="tag-cloud">
      {tags.map((tag: Tag) => (
        <button
          key={tag.name}
          data-testid={`tag-${tag.name}`}
          onClick={() => onTagClick(tag.name)}
        >
          {tag.name}
        </button>
      ))}
    </div>
  ),
  FilterPanel: ({
    onFeaturedChange,
    onTagRemove,
    selectedTags,
  }: FilterPanelProps) => (
    <div data-testid="filter-panel">
      <button
        data-testid="featured-toggle"
        onClick={() => onFeaturedChange(true)}
      >
        Featured Only
      </button>
      {selectedTags.map((tag: string) => (
        <button
          key={tag}
          data-testid={`remove-tag-${tag}`}
          onClick={() => onTagRemove(tag)}
        >
          Remove {tag}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/shared", () => ({
  Navigation: ({ currentPage, siteTitle }: NavigationProps) => (
    <nav data-testid="navigation">
      {currentPage} - {siteTitle}
    </nav>
  ),
  Pagination: ({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
  }: PaginationProps) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    return (
      <div data-testid="pagination">
        <button
          data-testid="prev-page"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          data-testid="next-page"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/search", () => ({
  SearchBar: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="search-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

vi.mock("@/components/filters", () => ({
  TagCloud: ({ tags, onTagClick }: any) => (
    <div data-testid="tag-cloud">
      {tags.map((tag: any) => (
        <button
          key={tag.name}
          data-testid={`tag-${tag.name}`}
          onClick={() => onTagClick(tag.name)}
        >
          {tag.name}
        </button>
      ))}
    </div>
  ),
  FilterPanel: ({ onFeaturedChange, onTagRemove, selectedTags }: any) => (
    <div data-testid="filter-panel">
      <button
        data-testid="featured-toggle"
        onClick={() => onFeaturedChange(true)}
      >
        Featured Only
      </button>
      {selectedTags.map((tag: string) => (
        <button
          key={tag}
          data-testid={`remove-tag-${tag}`}
          onClick={() => onTagRemove(tag)}
        >
          Remove {tag}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/shared", () => ({
  Navigation: ({ currentPage, siteTitle }: any) => (
    <nav data-testid="navigation">
      {currentPage} - {siteTitle}
    </nav>
  ),
  Pagination: ({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
  }: any) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    return (
      <div data-testid="pagination">
        <button
          data-testid="prev-page"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          data-testid="next-page"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    );
  },
}));

describe("Business Directory Integration", () => {
  const mockBusinesses = [
    {
      id: 1,
      name: "Test Restaurant",
      description: "A great restaurant",
      tags: ["restaurant", "food"],
      website: "https://restaurant.com",
      imageUrl: null,
      shareUrl: "https://example.com/business/1",
      rating: 4.5,
      reviewCount: 10,
    },
    {
      id: 2,
      name: "Test Store",
      description: "A retail store",
      tags: ["retail", "shopping"],
      website: "https://store.com",
      imageUrl: null,
      shareUrl: "https://example.com/business/2",
      rating: 4.0,
      reviewCount: 5,
    },
  ];

  const mockTags = [
    { name: "restaurant", count: 1 },
    { name: "food", count: 1 },
    { name: "retail", count: 1 },
    { name: "shopping", count: 1 },
  ];

  const mockConfig = {
    site: {
      title: "Test Site",
      tagline: "Test Tagline",
      directoryDescription: "Test Description",
      copyright: "2023",
      copyrightHolder: "Test",
      copyrightUrl: "https://test.com",
    },
    pagination: {
      defaultLimit: 20,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupComponentTest();
  });

  it("should load and display business cards", async () => {
    mockFetchResponses([
      {
        url: "/api/cards",
        response: {
          cards: mockBusinesses,
          total: 2,
        },
      },
      {
        url: "/api/tags",
        response: mockTags,
      },
      {
        url: "/api/config",
        response: mockConfig,
      },
      {
        url: "/api/auth/me",
        response: { error: { message: "Unauthorized" } },
        status: 401,
      },
    ]);

    renderWithProviders(<Home />);

    // Check that business cards are displayed
    await waitFor(() => {
      expect(screen.getByText("Test Restaurant")).toBeInTheDocument();
      expect(screen.getByText("Test Store")).toBeInTheDocument();
    });

    // Verify API was called
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/cards"),
      expect.any(Object)
    );
  });

  it("should handle pagination", async () => {
    mockFetchResponses([
      {
        url: "/api/cards",
        response: {
          cards: [mockBusinesses[0]],
          total: 25,
        },
      },
      {
        url: "/api/tags",
        response: mockTags,
      },
      {
        url: "/api/config",
        response: mockConfig,
      },
      {
        url: "/api/auth/me",
        response: { error: { message: "Unauthorized" } },
        status: 401,
      },
    ]);

    renderWithProviders(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Test Restaurant")).toBeInTheDocument();
    });

    // Find and click the next page button
    const nextButton = screen.getByTestId("next-page");
    await userEvent.click(nextButton);

    // Should update page state (page number should increase)
    await waitFor(() => {
      expect(screen.getByText(/Page 2/)).toBeInTheDocument();
    });
  });

  it("should filter by tags", async () => {
    mockFetchResponses([
      {
        url: "/api/cards",
        response: {
          cards: mockBusinesses,
          total: 2,
        },
      },
      {
        url: "/api/tags",
        response: mockTags,
      },
      {
        url: "/api/config",
        response: mockConfig,
      },
      {
        url: "/api/auth/me",
        response: { error: { message: "Unauthorized" } },
        status: 401,
      },
    ]);

    renderWithProviders(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Test Restaurant")).toBeInTheDocument();
    });

    // Click on a tag to filter
    const tagButton = await screen.findByTestId("tag-restaurant");
    await userEvent.click(tagButton);

    // Should add tag to selected tags
    await waitFor(() => {
      expect(screen.getByTestId("remove-tag-restaurant")).toBeInTheDocument();
    });
  });

  it("should handle search", async () => {
    mockFetchResponses([
      {
        url: "/api/cards",
        response: {
          cards: mockBusinesses,
          total: 2,
        },
      },
      {
        url: "/api/tags",
        response: mockTags,
      },
      {
        url: "/api/config",
        response: mockConfig,
      },
      {
        url: "/api/auth/me",
        response: { error: { message: "Unauthorized" } },
        status: 401,
      },
    ]);

    renderWithProviders(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Test Restaurant")).toBeInTheDocument();
    });

    // Find search input and type in it
    const searchInput = screen.getByTestId("search-input");
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "restaurant");

    // Should update search term
    await waitFor(() => {
      expect(searchInput).toHaveValue("restaurant");
    });
  });

  it("should handle loading states", async () => {
    // Mock a delayed response
    mockFetchResponses([
      {
        url: "/api/cards",
        response: new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                cards: mockBusinesses,
                total: 2,
              }),
            100
          )
        ),
      },
      {
        url: "/api/tags",
        response: mockTags,
      },
      {
        url: "/api/config",
        response: mockConfig,
      },
      {
        url: "/api/auth/me",
        response: { error: { message: "Unauthorized" } },
        status: 401,
      },
    ]);

    renderWithProviders(<Home />, { config: mockConfig });

    // Should show loading spinner initially
    expect(screen.getByText("Community Directory")).toBeInTheDocument();

    // Should show content after loading
    await waitFor(
      () => {
        expect(screen.getByText("Test Restaurant")).toBeInTheDocument();
      },
      { timeout: 200 }
    );
  });

  it("should handle API errors", async () => {
    mockFetchResponses([
      {
        url: "/api/cards",
        response: {
          error: {
            message: "Failed to load businesses",
          },
        },
        status: 500,
      },
      {
        url: "/api/tags",
        response: mockTags,
      },
      {
        url: "/api/config",
        response: mockConfig,
      },
      {
        url: "/api/auth/me",
        response: { error: { message: "Unauthorized" } },
        status: 401,
      },
    ]);

    renderWithProviders(<Home />);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Error Loading Directory/)).toBeInTheDocument();
    });
  });
});
