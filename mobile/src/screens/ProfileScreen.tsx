import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function ProfileScreen() {
  const { user, logout, isLoading } = useAuth();

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    backgroundColor: "#fff",
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "600",
    color: "#fff",
  },
  username: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#6b7280",
  },
  adminBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
  },
  section: {
    backgroundColor: "#fff",
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuItemText: {
    fontSize: 16,
    color: "#1f2937",
  },
  menuItemArrow: {
    fontSize: 18,
    color: "#9ca3af",
  },
  menuItemValue: {
    fontSize: 16,
    color: "#6b7280",
  },
  logoutButton: {
    backgroundColor: "#ef4444",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutButtonDisabled: {
    backgroundColor: "#fca5a5",
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    padding: 24,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#9ca3af",
  },
});
