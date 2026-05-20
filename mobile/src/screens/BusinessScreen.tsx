import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiClient } from "../api/client";
import type { Card } from "../types/api";
import type { RootStackParamList } from "../types/navigation";
import ErrorScreen from "../components/ErrorScreen";
import EmptyState from "../components/EmptyState";
import SkeletonLoader from "../components/SkeletonLoader";
import OfflineIndicator from "../components/OfflineIndicator";
import { useNetworkRefresh } from "../hooks/useNetworkRefresh";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

type BusinessScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "MainTabs"
>;

export default function BusinessScreen() {
  const navigation = useNavigation<BusinessScreenNavigationProp>();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border,
    } as const,
    cardContent: {
      overflow: "hidden",
      borderRadius: 12,
    } as const,
    cardInfo: {
      padding: 16,
    } as const,
    cardName: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.text,
      marginBottom: 4,
    } as const,
    cardDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 20,
    } as const,
    tags: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
    } as const,
    tag: {
      backgroundColor: colors.backgroundTertiary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    } as const,
    tagText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "500" as const,
    } as const,
    loadingFooter: {
      paddingVertical: 16,
    } as const,
    emptyContainer: {
      padding: 32,
      alignItems: "center",
    } as const,
    emptyText: {
      color: colors.textMuted,
      fontSize: 16,
      textAlign: "center",
      lineHeight: 22,
    } as const,
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      alignItems: "center",
    } as const,
    submitButtonText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "600" as const,
    } as const,
  }));

  const cardImageStyle = {
    width: "100%" as const,
    height: 160,
  };

  const loadCards = async (pageNum = 1, refresh = false) => {
    if (!refresh && pageNum === 1) {
      setIsLoading(true);
    }

    try {
      const response = await apiClient.getCards({
        page: pageNum,
        per_page: 20,
      });

      if (refresh || pageNum === 1) {
        setCards(response.items);
      } else {
        setCards((prev) => [...prev, ...response.items]);
      }

      setHasMore(response.page < response.pages);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load businesses";
      setError(errorMsg);
    } finally {
      if (!refresh && pageNum === 1) {
        setIsLoading(false);
      }
    }
  };

  // Network-aware refresh hook
  const { refreshControl } = useNetworkRefresh({
    onRefresh: async () => {
      await loadCards(1, true);
    },
  });

  useEffect(() => {
    loadCards();
  }, []);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadCards(page + 1);
    }
  };

  const renderCard = ({ item }: { item: Card }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("BusinessDetail", { id: item.id, slug: item.slug })
      }
    >
      <View style={styles.cardContent}>
        {item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            style={cardImageStyle}
            resizeMode="cover"
            alt={item.name}
          />
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>
          {item.tags.length > 0 && (
            <View style={styles.tags}>
              {item.tags.slice(0, 3).map((tag) => (
                <View key={tag.id} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.name}</Text>
                </View>
              ))}
              {item.tags.length > 3 && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>+{item.tags.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSkeletonCard = () => (
    <View style={styles.card}>
      <View style={{ ...cardImageStyle, backgroundColor: colors.surface }} />
      <View style={styles.cardInfo}>
        <SkeletonLoader width="70%" height={18} marginBottom={8} />
        <SkeletonLoader width="100%" height={14} count={2} marginBottom={12} />
        <View style={styles.tags}>
          <SkeletonLoader width={60} height={20} borderRadius={12} />
          <SkeletonLoader width={60} height={20} borderRadius={12} />
        </View>
      </View>
    </View>
  );

  if (isLoading && cards.length === 0) {
    return (
      <View style={styles.container}>
        <OfflineIndicator onRetry={() => loadCards(1)} />
        <FlatList
          data={[1, 2, 3]}
          renderItem={renderSkeletonCard}
          keyExtractor={(_, i) => `skeleton-${i}`}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            isAuthenticated ? (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => navigation.navigate("BusinessForm", { mode: "submit" })}
              >
                <Text style={styles.submitButtonText}>Submit a Business</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </View>
    );
  }

  if (error && cards.length === 0) {
    return (
      <View style={styles.container}>
        <OfflineIndicator onRetry={() => loadCards(1)} />
        <View style={styles.centered}>
          <EmptyState
            title="Unable to Load Businesses"
            message={error}
            action={{
              label: "Try Again",
              onPress: () => loadCards(1),
            }}
          />
        </View>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.container}>
        <FlatList
          data={[]}
          renderItem={renderCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No Businesses Found"
              message="Be the first to submit a business to CityForge!"
              action={
                isAuthenticated
                  ? {
                      label: "Submit a Business",
                      onPress: () => navigation.navigate("BusinessForm", { mode: "submit" }),
                    }
                  : undefined
              }
            />
          }
        />
      </View>
    );
  }

  if (isLoading && cards.length === 0) {
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
        onRetry={() => loadCards(1)}
        icon="business-outline"
      />
    );
  }

  return (
    <View style={styles.container}>
      <OfflineIndicator onRetry={() => loadCards(1)} />
      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          isAuthenticated ? (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => navigation.navigate("BusinessForm", { mode: "submit" })}
            >
              <Text style={styles.submitButtonText}>Submit a Business</Text>
            </TouchableOpacity>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshControl.refreshing}
            onRefresh={refreshControl.onRefresh}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoading && page > 1 ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.loadingFooter}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyState
              title="No Businesses Found"
              message="Be the first to submit a business to CityForge!"
              action={
                isAuthenticated
                  ? {
                      label: "Submit a Business",
                      onPress: () =>
                        navigation.navigate("BusinessForm", { mode: "submit" }),
                    }
                  : undefined
              }
            />
          </View>
        }
      />
    </View>
  );
}
