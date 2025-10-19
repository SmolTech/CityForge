import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagCloud } from "../filters";
import { Tag } from "@/lib/api";

describe("TagCloud", () => {
  const mockTags: Tag[] = [
    { name: "Restaurant", count: 100 },
    { name: "Retail", count: 75 },
    { name: "Service", count: 50 },
    { name: "Healthcare", count: 25 },
    { name: "Education", count: 10 },
  ];

  it("renders empty state when no tags are provided", () => {
    render(<TagCloud tags={[]} selectedTags={[]} onTagClick={vi.fn()} />);

    expect(screen.getByText("No tags available")).toBeInTheDocument();
  });

  it("renders all provided tags", () => {
    render(<TagCloud tags={mockTags} selectedTags={[]} onTagClick={vi.fn()} />);

    mockTags.forEach((tag) => {
      expect(screen.getByText(tag.name)).toBeInTheDocument();
    });
  });

  it("displays tag counts", () => {
    render(<TagCloud tags={mockTags} selectedTags={[]} onTagClick={vi.fn()} />);

    mockTags.forEach((tag) => {
      // Count is displayed next to the tag name
      expect(screen.getByText(tag.count.toString())).toBeInTheDocument();
    });
  });

  it("calls onTagClick with tag name when tag is clicked", async () => {
    const user = userEvent.setup();
    const handleTagClick = vi.fn();

    render(
      <TagCloud tags={mockTags} selectedTags={[]} onTagClick={handleTagClick} />
    );

    const restaurantButton = screen.getByRole("button", {
      name: /Restaurant/i,
    });
    await user.click(restaurantButton);

    expect(handleTagClick).toHaveBeenCalledWith("Restaurant");
  });

  it("applies different sizes based on tag count", () => {
    render(<TagCloud tags={mockTags} selectedTags={[]} onTagClick={vi.fn()} />);

    // Max count is 100
    // Restaurant (100) should be large: ratio > 0.8 = text-lg
    // Retail (75) should be medium: ratio > 0.5 = text-base
    // Service (50) should be medium: ratio = 0.5 = text-base
    // Healthcare (25) should be small: ratio > 0.2 = text-sm
    // Education (10) should be extra small: ratio < 0.2 = text-xs

    const restaurantButton = screen.getByRole("button", {
      name: /Restaurant/i,
    });
    expect(restaurantButton).toHaveClass("text-lg");

    const educationButton = screen.getByRole("button", { name: /Education/i });
    expect(educationButton).toHaveClass("text-xs");
  });

  it("highlights selected tags", () => {
    render(
      <TagCloud
        tags={mockTags}
        selectedTags={["Restaurant", "Retail"]}
        onTagClick={vi.fn()}
      />
    );

    const restaurantButton = screen.getByRole("button", {
      name: /Restaurant/i,
    });
    expect(restaurantButton).toHaveClass("bg-blue-50", "text-blue-700");

    const retailButton = screen.getByRole("button", { name: /Retail/i });
    expect(retailButton).toHaveClass("bg-blue-50", "text-blue-700");

    const serviceButton = screen.getByRole("button", { name: /Service/i });
    expect(serviceButton).not.toHaveClass("bg-blue-50");
    expect(serviceButton).not.toHaveClass("text-blue-700");
  });

  it("handles tags with zero count", () => {
    const tagsWithZero: Tag[] = [{ name: "Empty", count: 0 }];

    render(
      <TagCloud tags={tagsWithZero} selectedTags={[]} onTagClick={vi.fn()} />
    );

    // Tag should still be rendered but count should not be shown
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("renders title", () => {
    render(<TagCloud tags={mockTags} selectedTags={[]} onTagClick={vi.fn()} />);

    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("applies correct styling to tag cloud container", () => {
    const { container } = render(
      <TagCloud tags={mockTags} selectedTags={[]} onTagClick={vi.fn()} />
    );

    const tagCloudDiv = container.querySelector(".bg-white");
    expect(tagCloudDiv).toHaveClass("rounded-xl", "shadow-sm", "border", "p-5");
  });

  it("handles single tag", () => {
    const singleTag: Tag[] = [{ name: "Solo", count: 42 }];

    render(
      <TagCloud tags={singleTag} selectedTags={[]} onTagClick={vi.fn()} />
    );

    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("handles tag click for already selected tag", async () => {
    const user = userEvent.setup();
    const handleTagClick = vi.fn();

    render(
      <TagCloud
        tags={mockTags}
        selectedTags={["Restaurant"]}
        onTagClick={handleTagClick}
      />
    );

    const restaurantButton = screen.getByRole("button", {
      name: /Restaurant/i,
    });
    await user.click(restaurantButton);

    // Should still call handler (toggling logic is handled by parent)
    expect(handleTagClick).toHaveBeenCalledWith("Restaurant");
  });

  it("renders multiple selected tags correctly", () => {
    const allSelected = mockTags.map((tag) => tag.name);

    render(
      <TagCloud
        tags={mockTags}
        selectedTags={allSelected}
        onTagClick={vi.fn()}
      />
    );

    // Check specific tags instead of looping with RegExp
    const restaurantButton = screen.getByRole("button", {
      name: /Restaurant/i,
    });
    expect(restaurantButton).toHaveClass("bg-blue-50", "text-blue-700");

    const retailButton = screen.getByRole("button", { name: /Retail/i });
    expect(retailButton).toHaveClass("bg-blue-50", "text-blue-700");

    const serviceButton = screen.getByRole("button", { name: /Service/i });
    expect(serviceButton).toHaveClass("bg-blue-50", "text-blue-700");
  });

  it("calculates maximum count correctly", () => {
    const unevenTags: Tag[] = [
      { name: "Big", count: 1000 },
      { name: "Small", count: 1 },
    ];

    render(
      <TagCloud tags={unevenTags} selectedTags={[]} onTagClick={vi.fn()} />
    );

    // Big should be large (ratio = 1)
    const bigButton = screen.getByRole("button", { name: /Big/i });
    expect(bigButton).toHaveClass("text-lg");

    // Small should be extra small (ratio = 0.001)
    const smallButton = screen.getByRole("button", { name: /Small/i });
    expect(smallButton).toHaveClass("text-xs");
  });

  it("handles tags with special characters in names", () => {
    const specialTags: Tag[] = [
      { name: "Food & Beverage", count: 50 },
      { name: "Health/Wellness", count: 30 },
    ];

    render(
      <TagCloud tags={specialTags} selectedTags={[]} onTagClick={vi.fn()} />
    );

    expect(screen.getByText("Food & Beverage")).toBeInTheDocument();
    expect(screen.getByText("Health/Wellness")).toBeInTheDocument();
  });

  it("applies hover styles to unselected tags", () => {
    render(<TagCloud tags={mockTags} selectedTags={[]} onTagClick={vi.fn()} />);

    const serviceButton = screen.getByRole("button", { name: /Service/i });
    expect(serviceButton).toHaveClass(
      "hover:bg-blue-50",
      "hover:border-blue-300"
    );
  });

  it("applies border-2 to selected tags and border to unselected", () => {
    render(
      <TagCloud
        tags={mockTags}
        selectedTags={["Restaurant"]}
        onTagClick={vi.fn()}
      />
    );

    const selectedButton = screen.getByRole("button", { name: /Restaurant/i });
    expect(selectedButton).toHaveClass("border-2", "border-blue-500");

    const unselectedButton = screen.getByRole("button", { name: /Service/i });
    expect(unselectedButton).toHaveClass("border", "border-gray-200");
    expect(unselectedButton).not.toHaveClass("border-2");
  });

  it("calls onTagClick for each different tag click", async () => {
    const user = userEvent.setup();
    const handleTagClick = vi.fn();

    render(
      <TagCloud tags={mockTags} selectedTags={[]} onTagClick={handleTagClick} />
    );

    // Click multiple different tags
    await user.click(screen.getByRole("button", { name: /Restaurant/i }));
    await user.click(screen.getByRole("button", { name: /Healthcare/i }));
    await user.click(screen.getByRole("button", { name: /Education/i }));

    expect(handleTagClick).toHaveBeenCalledTimes(3);
    expect(handleTagClick).toHaveBeenNthCalledWith(1, "Restaurant");
    expect(handleTagClick).toHaveBeenNthCalledWith(2, "Healthcare");
    expect(handleTagClick).toHaveBeenNthCalledWith(3, "Education");
  });
});
