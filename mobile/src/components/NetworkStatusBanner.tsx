import React, { useState, useEffect, useCallback } from "react";
import { Text, StyleSheet, Animated } from "react-native";
import { networkManager } from "../utils/networkManager";

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(networkManager.isOnline());
  const [showBanner, setShowBanner] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-50));

  const hideBanner = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -50,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowBanner(false);
    });
  }, [slideAnim]);

  useEffect(() => {
    const unsubscribe = networkManager.addListener((state) => {
      const wasOnline = isOnline;
      const isNowOnline =
        state.isConnected && state.isInternetReachable !== false;

      setIsOnline(isNowOnline);

      // Show banner when going offline or coming back online
      if (wasOnline !== isNowOnline) {
        setShowBanner(true);

        // Slide down
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Hide after 3 seconds (for online) or keep visible (for offline)
        if (isNowOnline) {
          setTimeout(() => {
            hideBanner();
          }, 3000);
        }
      }
    });

    return unsubscribe;
  }, [isOnline, slideAnim, hideBanner]);

  if (!showBanner) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        isOnline ? styles.onlineBanner : styles.offlineBanner,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text
        style={[styles.text, isOnline ? styles.onlineText : styles.offlineText]}
      >
        {isOnline ? "🟢 Back online" : "🔴 No internet connection"}
      </Text>
      {!isOnline && (
        <Text style={[styles.subtext, styles.offlineText]}>
          Using cached data when available
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50, // Account for status bar
    zIndex: 1000,
    alignItems: "center",
  },
  onlineBanner: {
    backgroundColor: "#10b981",
  },
  offlineBanner: {
    backgroundColor: "#ef4444",
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtext: {
    fontSize: 12,
    marginTop: 2,
  },
  onlineText: {
    color: "#fff",
  },
  offlineText: {
    color: "#fff",
  },
});
