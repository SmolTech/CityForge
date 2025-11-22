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
import { useNetworkRefresh } from "../hooks/useNetworkRefresh";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";

type BusinessScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "MainTabs"
>;

export default function BusinessScreen() {
  const navigation = useNavigation<BusinessScreenNavigationProp>();
  const { colors } = useTheme();
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
      setError(err instanceof Error ? err.message : "Failed to load cards");
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
      onPress={() => navigation.navigate("BusinessDetail", { slug: item.slug })}
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
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
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
        onRetry={() => loadCards(1)}
        icon="business-outline"
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
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
      />
    </View>
  );
}
