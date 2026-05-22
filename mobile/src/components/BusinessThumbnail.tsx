import React from "react";
import { Image, StyleSheet, View, type ImageStyle, type ViewStyle } from "react-native";

import { useTheme } from "../contexts/ThemeContext";

interface BusinessThumbnailProps {
  uri?: string;
  alt?: string;
  height?: number;
}

export default function BusinessThumbnail({
  uri,
  alt,
  height = 140,
}: BusinessThumbnailProps) {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    container: {
      width: "100%",
      height,
      backgroundColor: colors.backgroundTertiary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    } as ViewStyle,
    image: {
      width: "100%",
      height: "100%",
    } as ImageStyle,
  });

  if (!uri) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        accessibilityLabel={alt}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}
