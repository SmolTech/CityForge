import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiClient } from "../api/client";
import type { Card, Tag } from "../types/api";
import type { RootStackParamList } from "../types/navigation";
import EmptyState from "../components/EmptyState";
import ErrorScreen from "../components/ErrorScreen";
import OfflineIndicator from "../components/OfflineIndicator";
import BusinessThumbnail from "../components/BusinessThumbnail";
import { useNetworkRefresh } from "../hooks/useNetworkRefresh";
import { useTheme } from "../contexts/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useAuth } from "../contexts/AuthContext";

type TagsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "MainTabs"
>;

export default function TagsScreen() {
  const navigation = useNavigation<TagsScreenNavigationProp>();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    tagList: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexGrow: 0,
      flexShrink: 0,
      maxHeight: 58,
    } as const,
    tagListContent: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      alignItems: "center",
    } as const,
    tagHint: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "center" as const,
      marginBottom: 6,
    } as const,
    tagChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 18,
      backgroundColor: colors.backgroundTertiary,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    } as const,
    tagChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    } as const,
    tagText: {
      fontSize: 14,
      fontWeight: "500" as const,
      color: colors.textSecondary,
    } as const,
    tagTextActive: {
      color: "#fff",
    } as const,
    list: {
      padding: 16,
    } as const,
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    } as const,
    cardContent: {
      overflow: "hidden",
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
      lineHeight: 20,
    } as const,
    emptyMessage: {
      color: colors.textMuted,
      fontSize: 16,
      textAlign: "center" as const,
    } as const,
  }));

  const loadCardsForTag = async (tag: Tag) => {
    const response = await apiClient.getCards({ tag: tag.name, per_page: 20 });
    setCards(response.items);
  };

  const loadData = async (refresh = false) => {
    if (!refresh) {
      setIsLoading(true);
    }

    try {
      const loadedTags = await apiClient.getTags();
      setTags(loadedTags);

      if (loadedTags.length === 0) {
        setSelectedTag(null);
        setCards([]);
        setError(null);
        return;
      }

      const nextSelectedTag =
        refresh || !selectedTag
          ? loadedTags[0] ?? null
          : loadedTags.find((tag) => tag.id === selectedTag.id) ?? loadedTags[0];

      setSelectedTag(nextSelectedTag);

      if (nextSelectedTag) {
        await loadCardsForTag(nextSelectedTag);
      } else {
        setCards([]);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tags");
    } finally {
      if (!refresh) {
        setIsLoading(false);
      }
    }
  };

  const { refreshControl } = useNetworkRefresh({
    onRefresh: async () => {
      await loadData(true);
    },
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTagSelect = async (tag: Tag) => {
    setSelectedTag(tag);
    try {
      await loadCardsForTag(tag);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load businesses");
    }
  };

  const renderTag = ({ item }: { item: Tag }) => (
    <TouchableOpacity
      style={[styles.tagChip, selectedTag?.id === item.id && styles.tagChipActive]}
      onPress={() => handleTagSelect(item)}
    >
      <Text
        style={[styles.tagText, selectedTag?.id === item.id && styles.tagTextActive]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderCard = ({ item }: { item: Card }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("BusinessDetail", { id: item.id, slug: item.slug })
      }
    >
      <View style={styles.cardContent}>
        <BusinessThumbnail uri={item.image_url} alt={item.name} height={120} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardDescription} numberOfLines={3}>
            {item.description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <OfflineIndicator onRetry={() => loadData()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error && tags.length === 0) {
    return (
      <ErrorScreen
        message={error}
        onRetry={() => loadData()}
        icon="pricetag-outline"
      />
    );
  }

  return (
    <View style={styles.container}>
      <OfflineIndicator onRetry={() => loadData()} />
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
        ListHeaderComponent={
          <>
            {tags.length > 1 ? (
              <Text style={styles.tagHint}>↔ Swipe left/right to see more tags</Text>
            ) : null}
            <FlatList
              data={tags}
              renderItem={renderTag}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.tagListContent}
              style={styles.tagList}
            />
            {selectedTag ? (
              <Text style={styles.emptyMessage}>
                Showing businesses tagged with "{selectedTag.name}"
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No Businesses Found"
            message={
              selectedTag
                ? `No businesses found for "${selectedTag.name}".`
                : "No tags are available yet."
            }
            action={
              isAuthenticated
                ? undefined
                : {
                    label: "Login",
                    onPress: () => navigation.navigate("Login"),
                  }
            }
          />
        }
      />
    </View>
  );
}
