import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { networkManager } from "../utils/networkManager";

interface OfflineIndicatorProps {
  onRetry?: () => void;
}

export default function OfflineIndicator({ onRetry }: OfflineIndicatorProps) {
  const isOffline = networkManager.isOffline();

  if (!isOffline) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: "#FFA500",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: "#ffffff",
      marginBottom: 2,
    },
    message: {
      fontSize: 12,
      color: "#ffffff",
      opacity: 0.9,
    },
    retryButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    retryText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#ffffff",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>No Internet Connection</Text>
        <Text style={styles.message}>Viewing cached data</Text>
      </View>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
