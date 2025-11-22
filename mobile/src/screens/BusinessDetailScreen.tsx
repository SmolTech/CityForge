import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiClient } from "../api/client";
import type { Card } from "../types/api";
import type { RootStackParamList } from "../types/navigation";
import { logger } from "../utils/logger";
import ErrorScreen from "../components/ErrorScreen";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../contexts/ThemeContext";

type BusinessDetailRouteProp = RouteProp<RootStackParamList, "BusinessDetail">;
type BusinessDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "BusinessDetail"
>;

export default function BusinessDetailScreen() {
  const route = useRoute<BusinessDetailRouteProp>();
  const navigation = useNavigation<BusinessDetailNavigationProp>();
  const { colors } = useTheme();
  const { slug } = route.params;

  const [card, setCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    } as const,
    content: {
      padding: 16,
    } as const,
    titleSection: {
      flexDirection: "row" as const,
      alignItems: "flex-start",
      marginBottom: 24,
    } as const,
    titleContainer: {
      flex: 1,
    } as const,
    businessName: {
      fontSize: 24,
      fontWeight: "bold" as const,
      color: colors.text,
      marginBottom: 8,
    } as const,
    tags: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
    } as const,
    tag: {
      backgroundColor: colors.backgroundTertiary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    } as const,
    tagText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "500" as const,
    } as const,
    section: {
      marginBottom: 24,
    } as const,
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.text,
      marginBottom: 12,
    } as const,
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
    } as const,
    contactItem: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 8,
      marginBottom: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      borderWidth: 1,
      borderColor: colors.border,
    } as const,
    contactLabel: {
      fontSize: 14,
      fontWeight: "500" as const,
      color: colors.textSecondary,
      marginBottom: 4,
    } as const,
    contactValue: {
      fontSize: 16,
      color: colors.text,
    } as const,
    linkText: {
      color: colors.primary,
    } as const,
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 12,
    } as const,
  }));

  const headerImageStyle = {
    width: "100%" as const,
    height: 200,
  };

  const logoStyle = {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: colors.surface,
  };

  const loadCardDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const cardData = await apiClient.getCardBySlug(slug);
      setCard(cardData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load business details";
      setError(errorMessage);
      logger.error("Error loading business details:", err);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadCardDetails();
  }, [loadCardDetails]);

  const handleContactPress = (type: string, value: string) => {
    let url = "";

    switch (type) {
      case "phone":
        url = `tel:${value}`;
        break;
      case "email":
        url = `mailto:${value}`;
        break;
      case "website":
        url = value.startsWith("http") ? value : `https://${value}`;
        break;
      case "facebook":
        url = value.startsWith("http")
          ? value
          : `https://facebook.com/${value}`;
        break;
      case "instagram":
        url = value.startsWith("http")
          ? value
          : `https://instagram.com/${value}`;
        break;
      case "twitter":
        url = value.startsWith("http") ? value : `https://twitter.com/${value}`;
        break;
      default:
        return;
    }

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open this link");
      }
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading business details...</Text>
      </View>
    );
  }

  if (error || !card) {
    return (
      <ErrorScreen
        message={error || "Business not found"}
        onRetry={loadCardDetails}
        onGoBack={() => navigation.goBack()}
        showGoBack={true}
        icon="storefront-outline"
      />
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Image */}
      {card.image_url && (
        <Image
          source={{ uri: card.image_url }}
          alt={`${card.name} header image`}
          style={headerImageStyle}
          resizeMode="cover"
        />
      )}

      {/* Business Info */}
      <View style={styles.content}>
        {/* Logo and Title Section */}
        <View style={styles.titleSection}>
          {card.logo_url && (
            <Image
              source={{ uri: card.logo_url }}
              alt={`${card.name} logo`}
              style={logoStyle}
              resizeMode="contain"
            />
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.businessName}>{card.name}</Text>
            {card.tags.length > 0 && (
              <View style={styles.tags}>
                {card.tags.map((tag) => (
                  <View key={tag.id} style={styles.tag}>
                    <Text style={styles.tagText}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {card.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{card.description}</Text>
          </View>
        )}

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          {card.address && (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleContactPress("address", card.address!)}
            >
              <Text style={styles.contactLabel}>Address</Text>
              <Text style={styles.contactValue}>{card.address}</Text>
            </TouchableOpacity>
          )}

          {card.phone && (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleContactPress("phone", card.phone!)}
            >
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={[styles.contactValue, styles.linkText]}>
                {card.phone}
              </Text>
            </TouchableOpacity>
          )}

          {card.email && (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleContactPress("email", card.email!)}
            >
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={[styles.contactValue, styles.linkText]}>
                {card.email}
              </Text>
            </TouchableOpacity>
          )}

          {card.website && (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleContactPress("website", card.website!)}
            >
              <Text style={styles.contactLabel}>Website</Text>
              <Text style={[styles.contactValue, styles.linkText]}>
                {card.website}
              </Text>
            </TouchableOpacity>
          )}

          {card.hours && (
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>Hours</Text>
              <Text style={styles.contactValue}>{card.hours}</Text>
            </View>
          )}
        </View>

        {/* Social Media */}
        {(card.facebook || card.instagram || card.twitter) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Media</Text>

            {card.facebook && (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleContactPress("facebook", card.facebook!)}
              >
                <Text style={styles.contactLabel}>Facebook</Text>
                <Text style={[styles.contactValue, styles.linkText]}>
                  {card.facebook}
                </Text>
              </TouchableOpacity>
            )}

            {card.instagram && (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleContactPress("instagram", card.instagram!)}
              >
                <Text style={styles.contactLabel}>Instagram</Text>
                <Text style={[styles.contactValue, styles.linkText]}>
                  {card.instagram}
                </Text>
              </TouchableOpacity>
            )}

            {card.twitter && (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleContactPress("twitter", card.twitter!)}
              >
                <Text style={styles.contactLabel}>Twitter</Text>
                <Text style={[styles.contactValue, styles.linkText]}>
                  {card.twitter}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
