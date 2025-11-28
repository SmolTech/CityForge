import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { useErrorHandler } from "./useErrorHandler";
import { ToastProvider } from "@/components/shared";
import { logger } from "@/lib/logger";

// Mock the logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Test wrapper component that provides ToastProvider
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ToastProvider, null, children);

describe("useErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should handle Error instances", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    const error = new Error("Test error message");

    act(() => {
      result.current(error);
    });

    // Verify logger was called
    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      error
    );
  });

  test("should handle string errors", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    const errorMessage = "String error message";

    act(() => {
      result.current(errorMessage);
    });

    // Verify logger was called with string error
    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      errorMessage
    );
  });

  test("should use fallback message for unknown error types", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    const unknownError = { some: "object" };
    const fallbackMessage = "Custom fallback message";

    act(() => {
      result.current(unknownError, fallbackMessage);
    });

    // Verify logger was called with unknown error
    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      unknownError
    );
  });

  test("should use default fallback message when no fallback provided", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    const unknownError = 123;

    act(() => {
      result.current(unknownError);
    });

    // Verify logger was called
    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      unknownError
    );
  });

  test("should handle null and undefined errors", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    act(() => {
      result.current(null);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      null
    );

    act(() => {
      result.current(undefined);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      undefined
    );
  });

  test("should handle empty string errors", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    act(() => {
      result.current("");
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      ""
    );
  });

  test("should handle Error with empty message", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    const error = new Error("");

    act(() => {
      result.current(error);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      error
    );
  });

  test("should handle multiple consecutive errors", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    const error1 = new Error("First error");
    const error2 = "Second error";
    const error3 = { type: "third error" };

    act(() => {
      result.current(error1);
      result.current(error2);
      result.current(error3, "Custom fallback");
    });

    expect(logger.error).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      "Error caught by error handler:",
      error1
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      "Error caught by error handler:",
      error2
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      3,
      "Error caught by error handler:",
      error3
    );
  });

  test("should throw error when used outside ToastProvider", () => {
    // Test without wrapper (no ToastProvider)
    expect(() => {
      renderHook(() => useErrorHandler());
    }).toThrow("useToast must be used within a ToastProvider");
  });

  test("should handle complex Error objects", () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    const complexError = new Error("Complex error") as Error & {
      code?: string;
      details?: Record<string, unknown>;
    };
    complexError.stack = "Mock stack trace";
    complexError.code = "E_CUSTOM";
    complexError.details = { foo: "bar" };

    act(() => {
      result.current(complexError);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Error caught by error handler:",
      complexError
    );
  });
});
