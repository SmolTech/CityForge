import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ErrorScreenProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  showRetry?: boolean;
  showGoBack?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function ErrorScreen({
  title = "Oops! Something went wrong",
  message,
  onRetry,
  onGoBack,
  showRetry = true,
  showGoBack = false,
  icon = "alert-circle-outline",
}: ErrorScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Error Icon */}
        <Ionicons name={icon} size={64} color="#ef4444" style={styles.icon} />

        {/* Error Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Error Message */}
        <Text style={styles.message}>{message}</Text>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {showRetry && onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Ionicons
                name="refresh"
                size={18}
                color="#fff"
                style={styles.buttonIcon}
              />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          {showGoBack && onGoBack && (
            <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
              <Ionicons
                name="arrow-back"
                size={18}
                color="#6b7280"
                style={styles.buttonIcon}
              />
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    alignItems: "center",
    maxWidth: 320,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  retryButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    backgroundColor: "transparent",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    flexDirection: "row",
    alignItems: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
});
