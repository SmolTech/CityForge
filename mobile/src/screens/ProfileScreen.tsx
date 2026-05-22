import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useInstance } from "../contexts/InstanceContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";
import type { ColorScheme } from "../theme/colors";
import {
  exportBusinessesToContacts,
  getBusinessContactSyncEnabled,
} from "../utils/businessContactSync";
import {
  exportCommunityCalendar,
  getCommunityCalendarSyncEnabled,
} from "../utils/communityCalendarSync";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, isLoading } = useAuth();
  const { activeInstance, instances } = useInstance();
  const { colors, colorScheme, setColorScheme } = useTheme();
  const [isExportingContacts, setIsExportingContacts] = useState(false);
  const [isContactSyncEnabled, setIsContactSyncEnabled] = useState(false);
  const [isExportingCalendar, setIsExportingCalendar] = useState(false);
  const [isCalendarSyncEnabled, setIsCalendarSyncEnabled] = useState(false);

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
    menuItemDisabled: {
      opacity: 0.6,
    } as const,
    sectionMessage: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    } as const,
    sectionHint: {
      paddingHorizontal: 16,
      paddingTop: 0,
      paddingBottom: 16,
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    } as const,
  }));

  useEffect(() => {
    if (!activeInstance?.id) {
      setIsContactSyncEnabled(false);
      setIsCalendarSyncEnabled(false);
      return;
    }

    let cancelled = false;
    void getBusinessContactSyncEnabled(activeInstance.id).then((enabled) => {
      if (!cancelled) {
        setIsContactSyncEnabled(enabled);
      }
    });
    void getCommunityCalendarSyncEnabled(activeInstance.id).then((enabled) => {
      if (!cancelled) {
        setIsCalendarSyncEnabled(enabled);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeInstance?.id]);

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

  const handleExportContacts = () => {
    if (!activeInstance?.id) {
      Alert.alert("No instance selected", "Choose a CityForge server first.");
      return;
    }

    Alert.alert(
      isContactSyncEnabled ? "Sync contacts now?" : "Enable contact sync?",
      isContactSyncEnabled
        ? "This will refresh your phone contacts from the current business list."
        : "This will add approved businesses to your phone's contacts and keep them updated automatically.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isContactSyncEnabled ? "Sync" : "Enable",
          onPress: async () => {
            setIsExportingContacts(true);
            try {
              const result = await exportBusinessesToContacts(activeInstance.id);
              setIsContactSyncEnabled(true);
              Alert.alert(
                "Contacts synced",
                `${result.total} businesses are now kept in sync with your contacts.`
              );
            } catch (error) {
              Alert.alert(
                "Sync failed",
                error instanceof Error ? error.message : "Unable to export contacts."
              );
            } finally {
              setIsExportingContacts(false);
            }
          },
        },
      ]
    );
  };

  const handleExportCalendar = () => {
    if (!activeInstance?.id) {
      Alert.alert("No instance selected", "Choose a CityForge server first.");
      return;
    }

    Alert.alert(
      isCalendarSyncEnabled ? "Sync calendar now?" : "Enable calendar sync?",
      isCalendarSyncEnabled
        ? "This will refresh your phone calendar from the current event list."
        : "This will add approved community events to your phone calendar and keep them updated automatically.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isCalendarSyncEnabled ? "Sync" : "Enable",
          onPress: async () => {
            setIsExportingCalendar(true);
            try {
              const result = await exportCommunityCalendar(activeInstance.id);
              setIsCalendarSyncEnabled(true);
              Alert.alert(
                "Calendar synced",
                `${result.total} events are now kept in sync with your calendar.`
              );
            } catch (error) {
              Alert.alert(
                "Sync failed",
                error instanceof Error ? error.message : "Unable to sync calendar."
              );
            } finally {
              setIsExportingCalendar(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenAdminDashboard = () => {
    if (!activeInstance?.apiUrl) {
      Alert.alert("No instance selected", "Choose a CityForge server first.");
      return;
    }

    const baseUrl = activeInstance.apiUrl.endsWith("/")
      ? activeInstance.apiUrl
      : `${activeInstance.apiUrl}/`;
    const adminUrl = new URL("manage/", baseUrl).toString();

    Linking.openURL(adminUrl).catch(() => {
      Alert.alert("Unable to open link", "Could not open the admin dashboard.");
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username?.charAt(0).toUpperCase() || "G"}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username || "Guest"}</Text>
        <Text style={styles.email}>{user?.email || "Browsing publicly"}</Text>
        {user?.is_admin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>

      {!user && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.menuItemText}>Login</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.menuItemText}>Register</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {user && (
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
      )}

      {user && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Activity</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("MySubmissions")}
          >
            <Text style={styles.menuItemText}>My Submissions</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                "Suggested Edits",
                "Open a business detail page and choose Suggest an Edit to submit changes."
              )
            }
          >
            <Text style={styles.menuItemText}>Suggested Edits</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contacts</Text>
        <TouchableOpacity
          style={[styles.menuItem, isExportingContacts && styles.menuItemDisabled]}
          onPress={handleExportContacts}
          disabled={isExportingContacts}
        >
          <Text style={styles.menuItemText}>
            {isContactSyncEnabled
              ? "Sync Business Contacts Now"
              : "Enable Business Contact Sync"}
          </Text>
          {isExportingContacts ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.menuItemArrow}>→</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.sectionMessage}>
          Save businesses to your phone contacts so you can call, email, or
          navigate directly from Contacts.
        </Text>
        <Text style={styles.sectionHint}>
          Once enabled, CityForge refreshes the exported contacts whenever the
          app resumes or periodically while it is open.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calendar</Text>
        <TouchableOpacity
          style={[styles.menuItem, isExportingCalendar && styles.menuItemDisabled]}
          onPress={handleExportCalendar}
          disabled={isExportingCalendar}
        >
          <Text style={styles.menuItemText}>
            {isCalendarSyncEnabled ? "Sync Community Calendar Now" : "Enable Calendar Sync"}
          </Text>
          {isExportingCalendar ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.menuItemArrow}>→</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.sectionMessage}>
          Save approved community events to your phone calendar so they stay in
          sync with CityForge.
        </Text>
        <Text style={styles.sectionHint}>
          Once enabled, CityForge refreshes your calendar whenever the app
          resumes or periodically while it is open.
        </Text>
      </View>

      {user?.is_admin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleOpenAdminDashboard}>
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

      {user && (
        <TouchableOpacity
          style={[styles.logoutButton, isLoading && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={isLoading}
        >
          <Text style={styles.logoutButtonText}>
            {isLoading ? "Logging out..." : "Logout"}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>CityForge Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
}
