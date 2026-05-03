import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { apiClient } from "../api/client";
import type { CardSubmission } from "../types/api";
import ErrorScreen from "../components/ErrorScreen";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";
import { logger } from "../utils/logger";

export default function MySubmissionsScreen() {
  const { colors } = useTheme();
  const [submissions, setSubmissions] = useState<CardSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    } as const,
    list: {
      padding: 16,
    } as const,
    submissionCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    } as const,
    submissionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 8,
    } as const,
    submissionName: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.text,
    } as const,
    statusBadge: {
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    } as const,
    statusText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: "600" as const,
      textTransform: "capitalize" as const,
    } as const,
    description: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 8,
    } as const,
    meta: {
      color: colors.textMuted,
      fontSize: 12,
    } as const,
    empty: {
      padding: 40,
      alignItems: "center",
    } as const,
    emptyText: {
      color: colors.textMuted,
      fontSize: 16,
      textAlign: "center",
      lineHeight: 22,
    } as const,
  }));

  const getStatusColor = (status: CardSubmission["status"]) => {
    switch (status) {
      case "approved":
        return colors.success;
      case "rejected":
        return colors.error;
      default:
        return colors.warning;
    }
  };

  const loadSubmissions = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const data = await apiClient.getMySubmissions();
      setSubmissions(data);
      setError(null);
    } catch (err) {
      logger.error("Error loading submissions:", err);
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const renderSubmission = ({ item }: { item: CardSubmission }) => (
    <View style={styles.submissionCard}>
      <View style={styles.submissionHeader}>
        <Text style={styles.submissionName}>{item.name}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      {item.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {item.description}
        </Text>
      ) : null}
      <Text style={styles.meta}>
        Submitted {new Date(item.created_date).toLocaleDateString()}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorScreen
        message={error}
        onRetry={() => loadSubmissions()}
        icon="document-text-outline"
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={submissions}
        renderItem={renderSubmission}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadSubmissions(true)}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              You have not submitted any businesses yet.
            </Text>
          </View>
        }
      />
    </View>
  );
}
