import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface ErrorMessageProps {
  error: string | Error;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Convert error messages to user-friendly text with specific guidance
 */
function getUserFriendlyError(error: string | Error): {
  title: string;
  message: string;
  suggestion: string;
} {
  const errorText =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

  if (errorText.includes("network") || errorText.includes("offline")) {
    return {
      title: "Connection Error",
      message: "Unable to connect to the server.",
      suggestion: "Check your internet connection and try again.",
    };
  }

  if (errorText.includes("timeout")) {
    return {
      title: "Request Timeout",
      message: "The server took too long to respond.",
      suggestion: "Check your connection speed or try again.",
    };
  }

  if (errorText.includes("404")) {
    return {
      title: "Not Found",
      message: "The requested content is not available.",
      suggestion: "This item may have been deleted. Go back and refresh.",
    };
  }

  if (errorText.includes("401") || errorText.includes("unauthorized")) {
    return {
      title: "Authentication Error",
      message: "Your session has expired.",
      suggestion: "Please log in again to continue.",
    };
  }

  if (errorText.includes("500") || errorText.includes("server")) {
    return {
      title: "Server Error",
      message: "The server encountered an error.",
      suggestion: "Please try again in a few moments.",
    };
  }

  return {
    title: "Error",
    message: errorText,
    suggestion: "Please try again or contact support if the problem persists.",
  };
}

export default function ErrorMessage({ error, onRetry, onDismiss }: ErrorMessageProps) {
  const { title, message, suggestion } = getUserFriendlyError(error);

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: "#FFE5E5",
      borderRadius: 8,
      borderLeftWidth: 4,
      borderLeftColor: "#FF4444",
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: "#CC0000",
      marginBottom: 4,
    },
    message: {
      fontSize: 13,
      color: "#666",
      marginBottom: 4,
      lineHeight: 18,
    },
    suggestion: {
      fontSize: 12,
      color: "#888",
      fontStyle: "italic",
      marginBottom: onRetry || onDismiss ? 12 : 0,
    },
    buttonContainer: {
      flexDirection: "row",
      gap: 8,
    },
    button: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      backgroundColor: "#FF4444",
      justifyContent: "center",
      alignItems: "center",
    },
    dismissButton: {
      backgroundColor: "#CCCCCC",
    },
    buttonText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#ffffff",
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.suggestion}>{suggestion}</Text>

      {(onRetry || onDismiss) && (
        <View style={styles.buttonContainer}>
          {onRetry && (
            <TouchableOpacity style={styles.button} onPress={onRetry}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={onDismiss}
            >
              <Text style={styles.buttonText}>Dismiss</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
