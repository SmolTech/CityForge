import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  marginBottom?: number;
  count?: number;
}

export default function SkeletonLoader({
  width = "100%",
  height = 16,
  borderRadius = 8,
  marginBottom = 12,
  count = 1,
}: SkeletonLoaderProps) {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  const skeletonStyle: any = {
    width: typeof width === "number" ? width : width,
    height,
    borderRadius,
    marginBottom,
    backgroundColor: colors.surface,
    opacity,
  };

  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View key={index} style={skeletonStyle} />
      ))}
    </View>
  );
}
