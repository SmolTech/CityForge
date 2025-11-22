import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useInstance } from "../contexts/InstanceContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";
import type { ColorScheme } from "../theme/colors";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, isLoading } = useAuth();
  const { activeInstance, instances } = useInstance();
  const { colorScheme, setColorScheme } = useTheme();

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    header: {
      backgroundColor: colors.surface,
      padding: 24,
      alignItems: "center" as const,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    } as const,
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: 12,
    } as const,
    avatarText: {
      fontSize: 32,
      fontWeight: "600" as const,
      color: colors.surface,
    } as const,
    username: {
      fontSize: 24,
      fontWeight: "600" as const,
      color: colors.text,
      marginBottom: 4,
    } as const,
    email: {
      fontSize: 14,
      color: colors.textSecondary,
    } as const,
    adminBadge: {
      backgroundColor: colors.warning + "20", // Add transparency
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.warning,
    } as const,
    adminBadgeText: {
      fontSize: 12,
      fontWeight: "600" as const,
      color: colors.warning,
    } as const,
    section: {
      backgroundColor: colors.surface,
      marginTop: 16,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    } as const,
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.backgroundTertiary,
    } as const,
    menuItem: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.backgroundTertiary,
    } as const,
    menuItemText: {
      fontSize: 16,
      color: colors.text,
    } as const,
    menuItemArrow: {
      fontSize: 18,
      color: colors.textMuted,
    } as const,
    menuItemValue: {
      fontSize: 16,
      color: colors.textSecondary,
    } as const,
    logoutButton: {
      backgroundColor: colors.error,
      margin: 16,
      padding: 16,
      borderRadius: 8,
      alignItems: "center" as const,
    } as const,
    logoutButtonDisabled: {
      backgroundColor: colors.textMuted,
    } as const,
    logoutButtonText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "600" as const,
    } as const,
    footer: {
      padding: 24,
      alignItems: "center" as const,
    } as const,
    footerText: {
      fontSize: 12,
      color: colors.textMuted,
    } as const,
    instanceInfo: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.backgroundTertiary,
    } as const,
    instanceDetails: {
      gap: 4,
    } as const,
    instanceLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: 4,
    } as const,
    instanceName: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
    } as const,
    instanceUrl: {
      fontSize: 13,
      color: colors.textSecondary,
    } as const,
    instanceCount: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 4,
    } as const,
    themeSelector: {
      flexDirection: "row" as const,
      justifyContent: "space-around" as const,
      alignItems: "center" as const,
      paddingHorizontal: 16,
      paddingVertical: 12,
    } as const,
    themeOption: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 80,
      alignItems: "center" as const,
    } as const,
    themeOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    } as const,
    themeOptionText: {
      fontSize: 14,
      color: colors.text,
    } as const,
    themeOptionActiveText: {
      color: colors.surface,
    } as const,
  }));

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            Alert.alert(
              "Error",
              error instanceof Error ? error.message : "Logout failed"
            );
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.is_admin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instance</Text>

        <View style={styles.instanceInfo}>
          <View style={styles.instanceDetails}>
            <Text style={styles.instanceLabel}>Current Community</Text>
            <Text style={styles.instanceName}>
              {activeInstance?.name || "No instance selected"}
            </Text>
            {activeInstance && (
              <Text style={styles.instanceUrl}>{activeInstance.apiUrl}</Text>
            )}
            {instances.length > 1 && (
              <Text style={styles.instanceCount}>
                {instances.length} instances available
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("InstanceManager")}
        >
          <Text style={styles.menuItemText}>Manage Instances</Text>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Edit Profile</Text>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Change Email</Text>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Change Password</Text>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Activity</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>My Submissions</Text>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Suggested Edits</Text>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {user?.is_admin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Admin Dashboard</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeSelector}>
          {(["light", "dark", "system"] as ColorScheme[]).map((scheme) => (
            <TouchableOpacity
              key={scheme}
              style={[
                styles.themeOption,
                colorScheme === scheme && styles.themeOptionActive,
              ]}
              onPress={() => setColorScheme(scheme)}
            >
              <Text
                style={[
                  styles.themeOptionText,
                  colorScheme === scheme && styles.themeOptionActiveText,
                ]}
              >
                {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Privacy Policy</Text>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Terms of Service</Text>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>Version</Text>
          <Text style={styles.menuItemValue}>1.0.0</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, isLoading && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={isLoading}
      >
        <Text style={styles.logoutButtonText}>
          {isLoading ? "Logging out..." : "Logout"}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>CityForge Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
}
