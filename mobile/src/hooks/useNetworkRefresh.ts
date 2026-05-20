import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { networkManager } from "../utils/networkManager";
import { logger } from "../utils/logger";

interface UseNetworkRefreshOptions {
  onRefresh: () => Promise<void>;
  showOfflineAlert?: boolean;
  offlineTitle?: string;
  offlineMessage?: string;
}

interface UseNetworkRefreshReturn {
  isRefreshing: boolean;
  handleRefresh: () => void;
  refreshControl: {
    refreshing: boolean;
    onRefresh: () => void;
  };
}

/**
 * Hook for network-aware pull-to-refresh functionality
 * Automatically handles offline detection and provides user feedback
 */
export function useNetworkRefresh({
  onRefresh,
  showOfflineAlert = true,
  offlineTitle = "No Internet Connection",
  offlineMessage = "Please check your internet connection and try again.",
}: UseNetworkRefreshOptions): UseNetworkRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    // Check network status before attempting refresh
    if (networkManager.isOffline()) {
      if (showOfflineAlert) {
        Alert.alert(offlineTitle, offlineMessage, [{ text: "OK" }]);
      }
      return;
    }

    if (isRefreshing) {
      return; // Prevent multiple concurrent refreshes
    }

    setIsRefreshing(true);

    try {
      await onRefresh();
    } catch (error) {
      logger.error("Refresh error:", error);

      // Show error alert for refresh failures
      Alert.alert(
        "Refresh Failed",
        "Unable to refresh data. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, showOfflineAlert, offlineTitle, offlineMessage]);

  return {
    isRefreshing,
    handleRefresh,
    refreshControl: {
      refreshing: isRefreshing,
      onRefresh: handleRefresh,
    },
  };
}
