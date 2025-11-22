import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, Image } from "react-native";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({
  message = "Loading...",
}: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require("../../assets/icon.png")}
            alt="CityForge App Icon"
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Loading Indicator */}
        <ActivityIndicator
          size="large"
          color="#3b82f6"
          style={styles.spinner}
        />

        {/* Loading Message */}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    padding: 20,
  },
  logoContainer: {
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    fontWeight: "500",
  },
});
