import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from "react-native";
import { useInstance } from "../contexts/InstanceContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useNetworkRefresh } from "../hooks/useNetworkRefresh";
import OfflineIndicator from "../components/OfflineIndicator";
import SkeletonLoader from "../components/SkeletonLoader";
import EmptyState from "../components/EmptyState";
import { apiClient } from "../api/client";
import type { CommunityCalendarEvent } from "../types/api";
import {
  loadCommunityCalendar,
  refreshCommunityCalendar,
} from "../utils/calendarEventCache";

export default function CalendarScreen() {
  const { activeInstance, isLoading: instancesLoading } = useInstance();
  const [events, setEvents] = useState<CommunityCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    } as const,
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    } as const,
    list: {
      padding: 16,
      gap: 16,
    } as const,
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as const,
    title: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: theme.text,
      marginBottom: 4,
    } as const,
    meta: {
      color: theme.textSecondary,
      fontSize: 13,
      marginBottom: 8,
    } as const,
    description: {
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    } as const,
    link: {
      color: theme.primary,
      fontWeight: "600" as const,
    } as const,
    header: {
      padding: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    } as const,
    headerTitle: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: theme.text,
    } as const,
    headerSubtitle: {
      color: theme.textSecondary,
      marginTop: 4,
    } as const,
  }));

  const loadEvents = async (refresh = false) => {
    if (!refresh) {
      setIsLoading(true);
    }
    try {
      if (!activeInstance?.id) {
        return;
      }
      apiClient.setBaseUrl(activeInstance.apiUrl);
      const loaded = refresh
        ? await refreshCommunityCalendar(activeInstance.id)
        : await loadCommunityCalendar(activeInstance.id);
      setEvents(loaded);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  const { refreshControl } = useNetworkRefresh({
    onRefresh: async () => {
      await loadEvents(true);
    },
  });

  useEffect(() => {
    if (instancesLoading || !activeInstance?.id) {
      return;
    }
    void loadEvents(false);
  }, [activeInstance?.apiUrl, activeInstance?.id, instancesLoading]);

  const renderSkeleton = () => (
    <View style={styles.card}>
      <SkeletonLoader width="70%" height={18} marginBottom={8} />
      <SkeletonLoader width="50%" height={12} marginBottom={8} />
      <SkeletonLoader width="100%" height={14} count={2} />
    </View>
  );

  const renderEvent = ({ item }: { item: CommunityCalendarEvent }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>
        {new Date(item.start_at).toLocaleString()}
        {item.end_at ? ` – ${new Date(item.end_at).toLocaleString()}` : ""}
        {item.location ? ` · ${item.location}` : ""}
      </Text>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      {item.url ? (
        <TouchableOpacity onPress={() => void Linking.openURL(item.url ?? "")}>
          <Text style={styles.link}>Open event link</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (isLoading && events.length === 0) {
    return (
      <View style={styles.container}>
        <OfflineIndicator onRetry={() => void loadEvents(false)} />
        <FlatList
          data={[1, 2, 3]}
          renderItem={renderSkeleton}
          keyExtractor={(_, index) => `event-skeleton-${index}`}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Calendar</Text>
        <Text style={styles.headerSubtitle}>Upcoming events from your CityForge instance.</Text>
      </View>
      <FlatList
        data={events}
        renderItem={renderEvent}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshControl.refreshing}
            onRefresh={refreshControl.onRefresh}
          />
        }
        ListEmptyComponent={
          error ? (
            <EmptyState title="Couldn’t load events" message={error} />
          ) : (
            <EmptyState
              title="No events yet"
              message="Approved events will appear here."
            />
          )
        }
      />
    </View>
  );
}
