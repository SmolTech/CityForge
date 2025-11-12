import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useInstance } from "../contexts/InstanceContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "AddInstance">;

export default function AddInstanceScreen({ navigation }: Props) {
  const { addInstance } = useInstance();
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleAddInstance = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a name for this instance");
      return;
    }

    if (!apiUrl.trim()) {
      Alert.alert("Error", "Please enter the API URL");
      return;
    }

    if (!validateUrl(apiUrl)) {
      Alert.alert(
        "Error",
        "Please enter a valid URL (e.g., https://worcester.community)"
      );
      return;
    }

    setIsLoading(true);

    try {
      // Create URL object to test the basic validity
      new URL(apiUrl);

      // For now, we'll skip the actual connection test and just validate the URL format
      // The connection will be tested when the user actually tries to use the instance

      // Generate a unique ID from the URL (remove protocol and special chars)
      const instanceId = apiUrl
        .replace(/^https?:\/\//, "")
        .replace(/[^a-z0-9-]/gi, "-")
        .toLowerCase();

      // Add the instance
      await addInstance({
        id: instanceId,
        name: name.trim(),
        apiUrl: apiUrl.trim(),
        token: null,
        user: null,
      });

      Alert.alert("Success", "Instance added successfully!", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error("Error adding instance:", error);
      Alert.alert(
        "Connection Failed",
        "Could not connect to this instance. Please check the URL and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Add CityForge Instance</Text>
        <Text style={styles.description}>
          Add a new CityForge community to your app. You can switch between
          multiple communities and maintain separate accounts for each.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Instance Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Worcester Community"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            editable={!isLoading}
          />

          <Text style={styles.label}>API URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://worcester.community"
            placeholderTextColor="#9ca3af"
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
            editable={!isLoading}
          />

          <Text style={styles.hint}>
            Enter the base URL of the CityForge instance (including https://)
          </Text>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleAddInstance}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Add Instance</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.examplesSection}>
          <Text style={styles.examplesTitle}>Example Instances:</Text>
          <Text style={styles.exampleItem}>
            • Worcester Community{"\n"} https://worcester.community
          </Text>
          <Text style={styles.exampleItem}>
            • Shrewsbuddy{"\n"} https://www.shrewsbuddy.com
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
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
    marginBottom: 30,
    lineHeight: 20,
  },
  form: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
    marginTop: -8,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#007AFF",
    fontSize: 16,
  },
  examplesSection: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 8,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  exampleItem: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
});
