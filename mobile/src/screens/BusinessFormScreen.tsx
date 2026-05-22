import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { ImageStyle } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { apiClient } from "../api/client";
import type { BusinessSubmissionInput } from "../types/api";
import type { RootStackParamList } from "../types/navigation";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";
import { logger } from "../utils/logger";

type BusinessFormRouteProp = RouteProp<RootStackParamList, "BusinessForm">;
type BusinessFormNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "BusinessForm"
>;

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

export default function BusinessFormScreen() {
  const route = useRoute<BusinessFormRouteProp>();
  const navigation = useNavigation<BusinessFormNavigationProp>();
  const { colors } = useTheme();
  const { mode } = route.params;
  const card = route.params.mode === "edit" ? route.params.card : undefined;
  const isEdit = mode === "edit";

  const [name, setName] = useState(card?.name ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(card?.website ?? "");
  const [phoneNumber, setPhoneNumber] = useState(card?.phone ?? "");
  const [email, setEmail] = useState(card?.email ?? "");
  const [address, setAddress] = useState(card?.address ?? "");
  const [contactName, setContactName] = useState("");
  const [selectedImage, setSelectedImage] = useState<PickedImage | null>(null);
  const [tags, setTags] = useState(card?.tags.map((tag) => tag.name) ?? []);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    scrollContent: {
      padding: 20,
    } as const,
    title: {
      fontSize: 24,
      fontWeight: "700" as const,
      color: colors.text,
      marginBottom: 8,
    } as const,
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 24,
    } as const,
    label: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.text,
      marginBottom: 8,
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
    tagRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
      marginBottom: 12,
    } as const,
    tagChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      borderRadius: 999,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    } as const,
    tagChipText: {
      color: colors.text,
      fontSize: 14,
    } as const,
    tagRemove: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: "700" as const,
      lineHeight: 16,
    } as const,
    textArea: {
      minHeight: 96,
      textAlignVertical: "top" as const,
    } as const,
    hint: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
      marginTop: -8,
      marginBottom: 16,
    } as const,
    imagePreview: {
      width: "100%" as const,
      aspectRatio: 16 / 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 12,
    } as const,
    imageButtonsRow: {
      flexDirection: "row" as const,
      gap: 12,
      marginBottom: 16,
    } as const,
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
    } as const,
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "500" as const,
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
    cancelButton: {
      padding: 16,
      alignItems: "center" as const,
    } as const,
    cancelButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "500" as const,
    } as const,
  }));
  const imagePreviewStyle = styles.imagePreview as ImageStyle;

  const buildPayload = (): BusinessSubmissionInput => ({
    name: name.trim(),
    description: optionalValue(description),
    websiteUrl: optionalValue(websiteUrl),
    phoneNumber: optionalValue(phoneNumber),
    email: optionalValue(email),
    address: optionalValue(address),
    contactName: optionalValue(contactName),
    image: selectedImage ?? undefined,
    tagsText: tags.length > 0 ? tags.join(", ") : undefined,
  });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Please allow photo library access to upload business images."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const fallbackExt = asset.uri.split(".").pop() || "jpg";
    const mimeType = asset.mimeType || `image/${fallbackExt.toLowerCase()}`;
    setSelectedImage({
      uri: asset.uri,
      name: asset.fileName || `business-image.${fallbackExt}`,
      type: mimeType,
    });
  };

  const commitTagInput = () => {
    const parsed = parseTags(tagInput);
    if (parsed.length === 0) {
      setTagInput("");
      return;
    }

    setTags((current) => {
      const next = new Set(current);
      for (const tag of parsed) {
        next.add(tag);
      }
      return Array.from(next);
    });
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Missing business name", "Please enter the business name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      if (isEdit && card) {
        await apiClient.suggestEdit(card.id, payload);
      } else {
        await apiClient.submitCard(payload);
      }

      Alert.alert(
        "Submitted",
        isEdit
          ? "Your suggested changes were sent for review."
          : "Your business submission was sent for review.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      logger.error("Business form submission failed:", error);
      Alert.alert(
        "Submission Failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIsSubmitting(false);
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
        <Text style={styles.title}>
          {isEdit ? "Suggest Business Edits" : "Submit a Business"}
        </Text>
        <Text style={styles.subtitle}>
          {isEdit
            ? "Update the fields that should change. Your edits will be reviewed before they appear publicly."
            : "Share a business with the community. Submissions are reviewed before they appear publicly."}
        </Text>

        <Text style={styles.label}>Business Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Business name"
          placeholderTextColor={colors.textMuted}
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What should people know about this business?"
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Website</Text>
        <TextInput
          style={styles.input}
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          placeholder="https://example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="(555) 555-5555"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="hello@example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Street, city, state"
          placeholderTextColor={colors.textMuted}
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Contact Name</Text>
        <TextInput
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
          placeholder="Who should admins contact if needed?"
          placeholderTextColor={colors.textMuted}
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Business Image</Text>
        {(selectedImage?.uri || card?.image_url) && (
          <Image
            style={imagePreviewStyle}
            source={{ uri: selectedImage?.uri || card?.image_url }}
            resizeMode="contain"
          />
        )}
        <View style={styles.imageButtonsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={pickImage}
            disabled={isSubmitting}
          >
            <Text style={styles.secondaryButtonText}>
              {selectedImage ? "Change image" : "Choose image"}
            </Text>
          </TouchableOpacity>
          {selectedImage && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setSelectedImage(null)}
              disabled={isSubmitting}
            >
              <Text style={styles.secondaryButtonText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.hint}>
          Select an image from your device. Images are uploaded with your submission.
        </Text>

        <Text style={styles.label}>Tags</Text>
        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => removeTag(tag)}
                disabled={isSubmitting}
              >
                <Text style={styles.tagChipText}>{tag}</Text>
                <Text style={styles.tagRemove}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TextInput
          style={styles.input}
          value={tagInput}
          onChangeText={setTagInput}
          placeholder="Type a tag and press Enter"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={commitTagInput}
          onBlur={commitTagInput}
          editable={!isSubmitting}
        />
        <Text style={styles.hint}>Press Enter to turn each tag into a bubble. Tap a bubble to remove it.</Text>

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>
              {isEdit ? "Submit Suggested Edits" : "Submit Business"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={isSubmitting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
