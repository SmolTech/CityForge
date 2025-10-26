import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { apiClient } from "../api/client";
import type { Card } from "../types/api";

export default function BusinessScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async (pageNum = 1, refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else if (pageNum === 1) {
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
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadCards(page + 1);
    }
  };

  const onRefresh = () => {
    loadCards(1, true);
  };

  const renderCard = ({ item }: { item: Card }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardContent}>
        {item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            style={styles.cardImage}
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

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadCards(1)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
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
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoading && page > 1 ? (
            <ActivityIndicator
              size="small"
              color="#3b82f6"
              style={styles.loadingFooter}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    overflow: "hidden",
    borderRadius: 12,
  },
  cardImage: {
    width: "100%",
    height: 160,
  },
  cardInfo: {
    padding: 16,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
    lineHeight: 20,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: "#0369a1",
    fontWeight: "500",
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingFooter: {
    paddingVertical: 16,
  },
});
