export interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;

  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;

  // UI element colors
  primary: string;
  success: string;
  warning: string;
  error: string;

  // Border and separator colors
  border: string;
  separator: string;

  // Card and surface colors
  surface: string;
  surfaceElevated: string;

  // Status bar colors
  statusBar: string;
}

export const lightTheme: ThemeColors = {
  background: "#f9fafb",
  backgroundSecondary: "#ffffff",
  backgroundTertiary: "#f3f4f6",

  text: "#1f2937",
  textSecondary: "#4b5563",
  textMuted: "#6b7280",

  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",

  border: "#e5e7eb",
  separator: "#d1d5db",

  surface: "#ffffff",
  surfaceElevated: "#ffffff",

  statusBar: "light-content",
};

export const darkTheme: ThemeColors = {
  background: "#0f172a",
  backgroundSecondary: "#1e293b",
  backgroundTertiary: "#334155",

  text: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",

  primary: "#60a5fa",
  success: "#34d399",
  warning: "#fbbf24",
  error: "#f87171",

  border: "#475569",
  separator: "#64748b",

  surface: "#1e293b",
  surfaceElevated: "#334155",

  statusBar: "light-content",
};

export type ColorScheme = "light" | "dark" | "system";
export type Theme = "light" | "dark";
