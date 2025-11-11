import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useInstance } from "../contexts/InstanceContext";
import type { Instance } from "../types/instance";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<any, "InstanceManager">;

export default function InstanceManagerScreen({ navigation }: Props) {
  const { instances, activeInstance, switchInstance, removeInstance } =
    useInstance();

  const handleSwitchInstance = async (instanceId: string) => {
    try {
      await switchInstance(instanceId);
      navigation.goBack();
    } catch (error) {
      console.error("Error switching instance:", error);
      Alert.alert("Error", "Failed to switch instance");
    }
  };

  const handleRemoveInstance = (instance: Instance) => {
    Alert.alert(
      "Remove Instance",
      `Are you sure you want to remove "${instance.name}"? You will need to add it again and re-login to use it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeInstance(instance.id);
            } catch (error) {
              console.error("Error removing instance:", error);
              Alert.alert("Error", "Failed to remove instance");
            }
          },
        },
      ]
    );
  };

  const formatLastActive = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Manage Instances</Text>
        <Text style={styles.description}>
          Switch between different CityForge communities or add new ones.
        </Text>

        {instances.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No instances added yet. Add your first CityForge community to get
              started.
            </Text>
          </View>
        ) : (
          <View style={styles.instancesList}>
            {instances.map((instance) => {
              const isActive = activeInstance?.id === instance.id;
              return (
                <View
                  key={instance.id}
                  style={[styles.instanceCard, isActive && styles.activeCard]}
                >
                  <TouchableOpacity
                    style={styles.instanceContent}
                    onPress={() => handleSwitchInstance(instance.id)}
                    disabled={isActive}
                  >
                    <View style={styles.instanceHeader}>
                      <Text style={styles.instanceName}>{instance.name}</Text>
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.instanceUrl}>{instance.apiUrl}</Text>
                    {instance.user ? (
                      <Text style={styles.instanceUser}>
                        Logged in as {instance.user.email}
                      </Text>
                    ) : (
                      <Text style={styles.instanceNotLoggedIn}>
                        Not logged in
                      </Text>
                    )}
                    <Text style={styles.lastActive}>
                      Last active: {formatLastActive(instance.lastActive)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveInstance(instance)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate("AddInstance")}
        >
          <Text style={styles.addButtonText}>+ Add New Instance</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  instancesList: {
    marginBottom: 20,
  },
  instanceCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  activeCard: {
    borderColor: "#007AFF",
    borderWidth: 2,
  },
  instanceContent: {
    padding: 16,
  },
  instanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  instanceName: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  activeBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  instanceUrl: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  instanceUser: {
    fontSize: 13,
    color: "#007AFF",
    marginBottom: 4,
  },
  instanceNotLoggedIn: {
    fontSize: 13,
    color: "#999",
    marginBottom: 4,
  },
  lastActive: {
    fontSize: 12,
    color: "#999",
  },
  removeButton: {
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    padding: 12,
    alignItems: "center",
  },
  removeButtonText: {
    color: "#ff3b30",
    fontSize: 14,
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
