import { useToast } from "@/components/shared";
import { logger } from "@/lib/logger";

/**
 * Hook for handling API errors with toast notifications.
 *
 * Usage:
 * ```tsx
 * const handleError = useErrorHandler();
 *
 * try {
 *   await apiClient.someMethod();
 * } catch (error) {
 *   handleError(error);
 * }
 * ```
 */
export function useErrorHandler() {
  const { showToast } = useToast();

  return (error: unknown, fallbackMessage?: string) => {
    let message = fallbackMessage || "An unexpected error occurred";

    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    }

    // Log to console for debugging
    logger.error("Error caught by error handler:", error);

    // Show toast notification
    showToast(message, "error");
  };
}
