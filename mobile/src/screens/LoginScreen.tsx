import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { useInstance } from "../contexts/InstanceContext";
import ErrorMessage from "../components/ErrorMessage";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";
import {
  getDefaultInstanceName,
  getInstanceId,
  isValidApiUrl,
  normalizeApiUrl,
} from "../utils/instanceUrl";
import type { Instance } from "../types/instance";
import type { RootStackParamList } from "../types/navigation";

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login, isLoading } = useAuth();
  const {
    instances,
    activeInstance,
    isLoading: instancesLoading,
    addInstance,
    switchInstance,
  } = useInstance();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverName, setServerName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = isLoading || instancesLoading;

  useEffect(() => {
    if (activeInstance) {
      setServerName(activeInstance.name);
      setServerUrl(activeInstance.apiUrl);
    }
  }, [activeInstance]);

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    content: {
      flex: 1,
      padding: 20,
      justifyContent: "center",
    } as const,
    scrollContent: {
      flexGrow: 1,
    } as const,
    title: {
      fontSize: 32,
      fontWeight: "bold" as const,
      marginBottom: 8,
      color: colors.text,
      textAlign: "center" as const,
    } as const,
    subtitle: {
      fontSize: 16,
      marginBottom: 24,
      color: colors.textSecondary,
      textAlign: "center" as const,
    } as const,
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600" as const,
      marginBottom: 8,
      color: colors.text,
    } as const,
    hint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: -8,
      marginBottom: 16,
      lineHeight: 16,
    } as const,
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      fontSize: 16,
      color: colors.text,
    } as const,
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: "center" as const,
      marginTop: 8,
    } as const,
    buttonDisabled: {
      backgroundColor: colors.textMuted,
    } as const,
    buttonText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "600" as const,
    } as const,
    linkButton: {
      marginTop: 16,
      alignItems: "center" as const,
    } as const,
    linkText: {
      color: colors.primary,
      fontSize: 14,
    } as const,
  }));

  const getLoginInstance = async (): Promise<Pick<
    Instance,
    "id" | "apiUrl"
  >> => {
    if (!serverUrl.trim()) {
      throw new Error("Please enter the CityForge server URL");
    }

    if (!isValidApiUrl(serverUrl)) {
      throw new Error(
        "Please enter a valid server URL, such as https://worcester.community"
      );
    }

    const normalizedApiUrl = normalizeApiUrl(serverUrl);
    const instanceId = getInstanceId(normalizedApiUrl);
    const existingInstance = instances.find(
      (instance) => instance.id === instanceId
    );
    const instanceName =
      serverName.trim() ||
      existingInstance?.name ||
      getDefaultInstanceName(normalizedApiUrl);

    await addInstance({
      id: instanceId,
      name: instanceName,
      apiUrl: normalizedApiUrl,
      token: existingInstance?.token ?? null,
      user: existingInstance?.user ?? null,
    });
    await switchInstance(instanceId);

    return {
      id: instanceId,
      apiUrl: normalizedApiUrl,
    };
  };

  const handleLogin = async () => {
    setError(null);

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    try {
      const targetInstance = await getLoginInstance();
      await login({ email, password }, targetInstance);
      // Navigation will happen automatically via AuthContext
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(errorMsg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Welcome to CityForge</Text>
          <Text style={styles.subtitle}>
            Choose your server and login to your account
          </Text>

          {error && (
            <ErrorMessage
              error={error}
              onDismiss={() => setError(null)}
              onRetry={handleLogin}
            />
          )}

          <Text style={styles.sectionTitle}>Server</Text>
          <TextInput
            style={styles.input}
            placeholder="Server URL"
            placeholderTextColor={colors.textMuted}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
            editable={!isSubmitting}
          />
          <Text style={styles.hint}>
            Enter your CityForge server, for example{" "}
            https://worcester.community
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Server name (optional)"
            placeholderTextColor={colors.textMuted}
            value={serverName}
            onChangeText={setServerName}
            autoCapitalize="words"
            editable={!isSubmitting}
          />

          <Text style={styles.sectionTitle}>Account</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isSubmitting}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isSubmitting}
          />

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate("Register")}
            disabled={isSubmitting}
          >
            <Text style={styles.linkText}>
              Don&apos;t have an account? Register
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
