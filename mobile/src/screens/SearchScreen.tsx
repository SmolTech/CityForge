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
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";

export default function SearchScreen() {
  const { colors } = useTheme();
  const [businessQuery, setBusinessQuery] = useState("");
  const [contentQuery, setContentQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"business" | "content">("business");
  const [businessResults, setBusinessResults] = useState<SearchResult[]>([]);
  const [contentResults, setContentResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    searchBarContainer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    } as const,
    tabBar: {
      flexDirection: "row" as const,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    } as const,
    tab: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    } as const,
    tabActive: {
      borderBottomColor: colors.primary,
    } as const,
    tabText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.textSecondary,
    } as const,
    tabTextActive: {
      color: colors.primary,
    } as const,
    searchBar: {
      flexDirection: "row" as const,
      padding: 16,
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
  }));

  const handleBusinessSearch = async () => {
    if (!businessQuery.trim()) {
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setError(null);

    try {
      const searchResults = await apiClient.searchCards(businessQuery);
      setBusinessResults(searchResults);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to search";
      setError(errorMsg);
      setBusinessResults([]);
      logger.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentSearch = async () => {
    if (!contentQuery.trim()) {
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setError(null);

    try {
      const searchResults = await apiClient.searchOpensearch(contentQuery);
      setContentResults(searchResults);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to search";
      setError(errorMsg);
      setContentResults([]);
      logger.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultPress = (url: string) => {
    try {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        logger.warn("Invalid URL scheme:", url);
        return;
      }
      Linking.openURL(url).catch((err) =>
        logger.error("Error opening URL:", err)
      );
    } catch (error) {
      logger.error("Error in handleResultPress:", error);
    }
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

  const currentQuery = activeTab === "business" ? businessQuery : contentQuery;
  const currentResults = activeTab === "business" ? businessResults : contentResults;
  const handleSearch =
    activeTab === "business" ? handleBusinessSearch : handleContentSearch;

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "business" && styles.tabActive]}
            onPress={() => setActiveTab("business")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "business" && styles.tabTextActive,
              ]}
            >
              Businesses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "content" && styles.tabActive]}
            onPress={() => setActiveTab("content")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "content" && styles.tabTextActive,
              ]}
            >
              Content
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === "business"
                ? "Search businesses..."
                : "Search content..."
            }
            value={currentQuery}
            onChangeText={
              activeTab === "business" ? setBusinessQuery : setContentQuery
            }
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor={colors.textMuted}
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
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {activeTab === "business"
              ? "Searching businesses..."
              : "Searching content..."}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ErrorMessage
            error={error}
            onRetry={handleSearch}
            onDismiss={() => {
              setError(null);
              setHasSearched(false);
            }}
          />
        </View>
      ) : hasSearched ? (
        <FlatList
          data={currentResults}
          renderItem={renderResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          ListHeaderComponent={
            currentResults.length > 0 ? (
              <Text style={styles.placeholderText}>
                Found {currentResults.length} result
                {currentResults.length !== 1 ? "s" : ""}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="No Results Found"
              message={`No ${activeTab === "business" ? "businesses" : "content"} match "${currentQuery}". Try different keywords.`}
              action={{
                label: "Clear Search",
                onPress: () => {
                  if (activeTab === "business") {
                    setBusinessQuery("");
                    setBusinessResults([]);
                  } else {
                    setContentQuery("");
                    setContentResults([]);
                  }
                  setHasSearched(false);
                  setError(null);
                },
              }}
            />
          }
        />
      ) : (
        <View style={styles.centered}>
          <EmptyState
            title={
              activeTab === "business"
                ? "Search Businesses"
                : "Search Content"
            }
            message={
              activeTab === "business"
                ? "Enter a keyword to find local businesses, categories, or locations."
                : "Enter keywords to search helpful content and resources."
            }
          />
        </View>
      )}
    </View>
  );
}
