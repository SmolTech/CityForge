import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Appearance, StatusBar } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  lightTheme,
  darkTheme,
  ThemeColors,
  ColorScheme,
  Theme,
} from "../theme/colors";
import { logger } from "../utils/logger";

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => Promise<void>;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = "@cityforge_theme_preference";

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("system");
  const [systemTheme, setSystemTheme] = useState<Theme>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );

  // Determine active theme based on color scheme preference
  const theme: Theme = colorScheme === "system" ? systemTheme : colorScheme;
  const colors = theme === "dark" ? darkTheme : lightTheme;
  const isDark = theme === "dark";

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(
      ({ colorScheme: newScheme }) => {
        const newTheme = newScheme === "dark" ? "dark" : "light";
        setSystemTheme(newTheme);
        logger.info(`System theme changed to: ${newTheme}`);
      }
    );

    return () => subscription.remove();
  }, []);

  // Update status bar when theme changes
  useEffect(() => {
    StatusBar.setBarStyle(isDark ? "light-content" : "dark-content");
  }, [isDark]);

  const loadThemePreference = async () => {
    try {
      const savedScheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedScheme && ["light", "dark", "system"].includes(savedScheme)) {
        setColorSchemeState(savedScheme as ColorScheme);
        logger.info(`Loaded theme preference: ${savedScheme}`);
      }
    } catch (error) {
      logger.error("Error loading theme preference:", error);
    }
  };

  const setColorScheme = async (scheme: ColorScheme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, scheme);
      setColorSchemeState(scheme);
      logger.info(`Theme preference saved: ${scheme}`);
    } catch (error) {
      logger.error("Error saving theme preference:", error);
    }
  };

  const contextValue: ThemeContextType = {
    theme,
    colors,
    colorScheme,
    setColorScheme,
    isDark,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
