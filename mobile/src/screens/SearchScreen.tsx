import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { apiClient } from "../api/client";
import { logger } from "../utils/logger";
import type { SearchResult } from "../types/api";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";

export default function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    searchBar: {
      flexDirection: "row" as const,
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    } as const,
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
    } as const,
    searchButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      borderRadius: 8,
      justifyContent: "center",
    } as const,
    searchButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600" as const,
    } as const,
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    } as const,
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.textSecondary,
    } as const,
    placeholderText: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: "center",
    } as const,
    resultsList: {
      padding: 16,
    } as const,
    result: {
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
    resultTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
      marginBottom: 8,
    } as const,
    resultContent: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    } as const,
    resultFooter: {
      flexDirection: "row" as const,
      justifyContent: "space-between",
      alignItems: "center",
    } as const,
    resultScore: {
      fontSize: 12,
      color: colors.textMuted,
    } as const,
    emptyContainer: {
      padding: 40,
      alignItems: "center",
    } as const,
    emptyText: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.textSecondary,
      marginBottom: 8,
    } as const,
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
    } as const,
  }));

  const handleSearch = async () => {
    if (!query.trim()) {
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const searchResults = await apiClient.search(query);
      setResults(searchResults);
    } catch (error) {
      logger.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultPress = (url: string) => {
    Linking.openURL(url).catch((err) =>
      logger.error("Error opening URL:", err)
    );
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.result}
      onPress={() => handleResultPress(item.url)}
    >
      <Text style={styles.resultTitle}>{item.title}</Text>
      <Text style={styles.resultContent} numberOfLines={3}>
        {item.content}
      </Text>
      <View style={styles.resultFooter}>
        <Text style={styles.resultScore}>
          Relevance: {Math.round(item.score * 100)}%
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search businesses..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={isLoading}
        >
          <Text style={styles.searchButtonText}>
            {isLoading ? "..." : "Search"}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : hasSearched ? (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results found</Text>
              <Text style={styles.emptySubtext}>
                Try different keywords or browse the directory
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.placeholderText}>
            Enter a search term to find businesses
          </Text>
        </View>
      )}
    </View>
  );
}
