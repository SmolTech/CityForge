import { useTheme } from "../contexts/ThemeContext";
import { StyleSheet, ImageStyle, TextStyle, ViewStyle } from "react-native";

type StyleFunction<
  T extends Record<string, ViewStyle | TextStyle | ImageStyle>,
> = (
  colors: ReturnType<typeof useTheme>["colors"]
) => StyleSheet.NamedStyles<T>;

/**
 * Hook for creating themed styles that automatically update with theme changes
 *
 * @param styleFunction - Function that takes theme colors and returns StyleSheet styles
 * @returns Computed styles for current theme
 *
 * @example
 * ```tsx
 * const styles = useThemedStyles((colors) => ({
 *   container: {
 *     backgroundColor: colors.background,
 *     borderColor: colors.border,
 *   },
 *   text: {
 *     color: colors.text,
 *   },
 * }));
 * ```
 */
export function useThemedStyles<
  T extends Record<string, ViewStyle | TextStyle | ImageStyle>,
>(styleFunction: StyleFunction<T>): StyleSheet.NamedStyles<T> {
  const { colors } = useTheme();
  return StyleSheet.create(styleFunction(colors));
}
