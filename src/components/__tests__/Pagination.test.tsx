import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "../shared";

describe("Pagination", () => {
  it("renders nothing when totalPages is 1 or less", () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalItems={10}
        itemsPerPage={20}
        onPageChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Previous and Next buttons", () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={100}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /previous page/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next page/i })
    ).toBeInTheDocument();
  });

  it("disables Previous button on first page", () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={100}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /previous page/i })
    ).toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(
      <Pagination
        currentPage={10}
        totalItems={100}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("calls onPageChange with correct page when Previous is clicked", async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        currentPage={5}
        totalItems={100}
        itemsPerPage={10}
        onPageChange={handlePageChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /previous page/i }));
    expect(handlePageChange).toHaveBeenCalledWith(4);
  });

  it("calls onPageChange with correct page when Next is clicked", async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        currentPage={5}
        totalItems={100}
        itemsPerPage={10}
        onPageChange={handlePageChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(handlePageChange).toHaveBeenCalledWith(6);
  });

  it("calls onPageChange when a page number is clicked", async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        currentPage={1}
        totalItems={100}
        itemsPerPage={10}
        onPageChange={handlePageChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it("shows all pages when total pages is 7 or less", () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={70}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    // Should show pages 1-7
    for (let i = 1; i <= 7; i++) {
      expect(
        screen.getByRole("button", { name: `Page ${i}` })
      ).toBeInTheDocument();
    }
  });

  it("shows ellipsis when total pages is more than 7", () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={200}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    // Should have ellipsis
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("highlights the current page", () => {
    render(
      <Pagination
        currentPage={3}
        totalItems={100}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    const currentPageButton = screen.getByRole("button", {
      name: "Page 3",
      current: "page",
    });
    expect(currentPageButton).toBeInTheDocument();
    expect(currentPageButton).toHaveClass("bg-blue-600");
  });

  it("shows correct page numbers when near the beginning", () => {
    render(
      <Pagination
        currentPage={2}
        totalItems={200}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    // Should show: 1, 2, 3, 4, 5, ..., 20
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 20" })).toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("shows correct page numbers when near the end", () => {
    render(
      <Pagination
        currentPage={19}
        totalItems={200}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    // Should show: 1, ..., 16, 17, 18, 19, 20
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 16" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 17" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 18" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 19" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 20" })).toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("shows correct page numbers when in the middle", () => {
    render(
      <Pagination
        currentPage={10}
        totalItems={200}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    // Should show: 1, ..., 9, 10, 11, ..., 20
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 9" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 11" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 20" })).toBeInTheDocument();
    expect(screen.getAllByText("...")).toHaveLength(2);
  });

  it("calculates total pages correctly", () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={95}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    );

    // 95 items / 10 per page = 10 pages (rounded up)
    expect(screen.getByRole("button", { name: "Page 10" })).toBeInTheDocument();
  });
});
