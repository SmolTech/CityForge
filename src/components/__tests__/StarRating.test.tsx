import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StarRating from "../StarRating";

describe("StarRating", () => {
  it("renders the correct number of stars", () => {
    render(<StarRating rating={3} maxRating={5} />);

    const stars = screen.getAllByRole("button");
    expect(stars).toHaveLength(5);
  });

  it("renders custom maxRating number of stars", () => {
    render(<StarRating rating={5} maxRating={10} />);

    const stars = screen.getAllByRole("button");
    expect(stars).toHaveLength(10);
  });

  it("displays filled stars based on rating", () => {
    render(<StarRating rating={3} maxRating={5} />);

    // Check aria-labels to verify star values
    expect(screen.getByLabelText("1 star")).toBeInTheDocument();
    expect(screen.getByLabelText("2 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("3 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("4 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("5 stars")).toBeInTheDocument();
  });

  it("applies small size class", () => {
    const { container } = render(<StarRating rating={3} size="sm" />);

    const svgs = container.querySelectorAll("svg");
    expect(svgs[0]).toHaveClass("w-4", "h-4");
  });

  it("applies medium size class by default", () => {
    const { container } = render(<StarRating rating={3} />);

    const svgs = container.querySelectorAll("svg");
    expect(svgs[0]).toHaveClass("w-5", "h-5");
  });

  it("applies large size class", () => {
    const { container } = render(<StarRating rating={3} size="lg" />);

    const svgs = container.querySelectorAll("svg");
    expect(svgs[0]).toHaveClass("w-6", "h-6");
  });

  it("renders as non-interactive by default", () => {
    render(<StarRating rating={3} />);

    const stars = screen.getAllByRole("button");
    stars.forEach((star) => {
      expect(star).toBeDisabled();
      expect(star).toHaveClass("cursor-default");
    });
  });

  it("renders as interactive when interactive prop is true", () => {
    render(
      <StarRating rating={3} interactive={true} onRatingChange={vi.fn()} />
    );

    const stars = screen.getAllByRole("button");
    stars.forEach((star) => {
      expect(star).not.toBeDisabled();
      expect(star).toHaveClass("cursor-pointer");
    });
  });

  it("calls onRatingChange when a star is clicked in interactive mode", async () => {
    const user = userEvent.setup();
    const handleRatingChange = vi.fn();

    render(
      <StarRating
        rating={3}
        interactive={true}
        onRatingChange={handleRatingChange}
      />
    );

    const fourthStar = screen.getByLabelText("4 stars");
    await user.click(fourthStar);

    expect(handleRatingChange).toHaveBeenCalledWith(4);
  });

  it("does not call onRatingChange when not interactive", async () => {
    const user = userEvent.setup();
    const handleRatingChange = vi.fn();

    render(
      <StarRating
        rating={3}
        interactive={false}
        onRatingChange={handleRatingChange}
      />
    );

    const fourthStar = screen.getByLabelText("4 stars");
    await user.click(fourthStar);

    expect(handleRatingChange).not.toHaveBeenCalled();
  });

  it("handles zero rating", () => {
    const { container } = render(<StarRating rating={0} maxRating={5} />);

    const stars = container.querySelectorAll("button");
    expect(stars).toHaveLength(5);

    // All stars should be unfilled (gray)
    const svgs = container.querySelectorAll("svg");
    svgs.forEach((svg) => {
      expect(svg).toHaveClass("text-gray-300");
    });
  });

  it("handles full rating", () => {
    const { container } = render(<StarRating rating={5} maxRating={5} />);

    const stars = container.querySelectorAll("button");
    expect(stars).toHaveLength(5);

    // All stars should be filled (yellow)
    const svgs = container.querySelectorAll("svg");
    svgs.forEach((svg) => {
      expect(svg).toHaveClass("text-yellow-400");
    });
  });

  it("handles decimal ratings with half stars", () => {
    render(<StarRating rating={3.5} maxRating={5} />);

    // Should render 3 full stars, 1 half star, and 1 empty star
    const stars = screen.getAllByRole("button");
    expect(stars).toHaveLength(5);
  });

  it("calls onRatingChange with correct value for each star", async () => {
    const user = userEvent.setup();
    const handleRatingChange = vi.fn();

    render(
      <StarRating
        rating={0}
        interactive={true}
        onRatingChange={handleRatingChange}
      />
    );

    // Click each star and verify the callback
    for (let i = 1; i <= 5; i++) {
      const star = screen.getByLabelText(`${i} star${i > 1 ? "s" : ""}`);
      await user.click(star);
      expect(handleRatingChange).toHaveBeenCalledWith(i);
    }

    expect(handleRatingChange).toHaveBeenCalledTimes(5);
  });

  it("applies hover effects in interactive mode", () => {
    render(
      <StarRating rating={3} interactive={true} onRatingChange={vi.fn()} />
    );

    const stars = screen.getAllByRole("button");
    stars.forEach((star) => {
      expect(star).toHaveClass("hover:scale-110", "transition-transform");
    });
  });

  it("does not apply hover effects in non-interactive mode", () => {
    render(<StarRating rating={3} interactive={false} />);

    const stars = screen.getAllByRole("button");
    stars.forEach((star) => {
      expect(star).not.toHaveClass("hover:scale-110");
      expect(star).not.toHaveClass("transition-transform");
    });
  });
});
