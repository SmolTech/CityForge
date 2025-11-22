import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { apiClient } from "../api/client";
import { logger } from "../utils/logger";
import type { ResourceCategory, ResourceItem } from "../types/api";
import ErrorScreen from "../components/ErrorScreen";
import { useNetworkRefresh } from "../hooks/useNetworkRefresh";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";

export default function ResourcesScreen() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
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
    categoryList: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    } as const,
    categoryListContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    } as const,
    categoryTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    } as const,
    categoryTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    } as const,
    categoryText: {
      fontSize: 14,
      fontWeight: "500" as const,
      color: colors.textSecondary,
    } as const,
    categoryTextActive: {
      color: "#fff",
    } as const,
    itemList: {
      padding: 16,
    } as const,
    item: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    } as const,
    itemTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
      marginBottom: 4,
    } as const,
    itemDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    } as const,
    itemUrl: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: "500" as const,
    } as const,
    emptyContainer: {
      padding: 40,
      alignItems: "center",
    } as const,
    emptyText: {
      fontSize: 16,
      color: colors.textMuted,
    } as const,
  }));

  const loadData = async (refresh = false) => {
    if (!refresh) {
      setIsLoading(true);
    }

    try {
      const categoriesData = await apiClient.getResourceCategories();
      setCategories(categoriesData);
      setError(null);

      if (categoriesData.length > 0) {
        const firstCategory = categoriesData[0];
        if (firstCategory) {
          setSelectedCategory(firstCategory.id);
          await loadItems(firstCategory.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    } finally {
      if (!refresh) {
        setIsLoading(false);
      }
    }
  };

  // Network-aware refresh hook
  const { refreshControl } = useNetworkRefresh({
    onRefresh: async () => {
      await loadData(true);
    },
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (categories.length > 0 && selectedCategory === null) {
      const firstCategory = categories[0];
      if (firstCategory) {
        setSelectedCategory(firstCategory.id);
        loadItems(firstCategory.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const loadItems = async (categoryId: number) => {
    try {
      const itemsData = await apiClient.getResourceItems(categoryId);
      setItems(itemsData);
    } catch (err) {
      logger.error("Error loading items:", err);
    }
  };

  const handleCategorySelect = (categoryId: number) => {
    setSelectedCategory(categoryId);
    loadItems(categoryId);
  };

  const handleItemPress = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        logger.error("Error opening URL:", err)
      );
    }
  };

  const renderCategory = ({ item }: { item: ResourceCategory }) => (
    <TouchableOpacity
      style={[
        styles.categoryTab,
        selectedCategory === item.id && styles.categoryTabActive,
      ]}
      onPress={() => handleCategorySelect(item.id)}
    >
      <Text
        style={[
          styles.categoryText,
          selectedCategory === item.id && styles.categoryTextActive,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: ResourceItem }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => handleItemPress(item.url)}
      disabled={!item.url}
    >
      <Text style={styles.itemTitle}>{item.title}</Text>
      {item.description && (
        <Text style={styles.itemDescription}>{item.description}</Text>
      )}
      {item.url && <Text style={styles.itemUrl}>View Resource →</Text>}
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
        onRetry={() => loadData()}
        icon="library-outline"
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id.toString()}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryListContent}
        showsHorizontalScrollIndicator={false}
      />

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.itemList}
        refreshControl={
          <RefreshControl
            refreshing={refreshControl.refreshing}
            onRefresh={refreshControl.onRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No resources available</Text>
          </View>
        }
      />
    </View>
  );
}
