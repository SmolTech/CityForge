import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";
import type { RootStackParamList } from "../types/navigation";

type RegisterScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Register"
>;

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { register, isLoading } = useAuth();
  const { colors } = useTheme();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    scrollContent: {
      flexGrow: 1,
    } as const,
    content: {
      flex: 1,
      padding: 20,
      justifyContent: "center",
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
      marginBottom: 32,
      color: colors.textSecondary,
      textAlign: "center" as const,
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

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });
      // Navigation will happen automatically via AuthContext
    } catch (error) {
      Alert.alert(
        "Registration Failed",
        error instanceof Error ? error.message : "An error occurred"
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the CityForge community</Text>

          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor={colors.textMuted}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor={colors.textMuted}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? "Creating account..." : "Register"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate("Login")}
            disabled={isLoading}
          >
            <Text style={styles.linkText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
