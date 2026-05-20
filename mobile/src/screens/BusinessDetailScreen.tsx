import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiClient } from "../api/client";
import type { Card, CardReviewsResponse, Review } from "../types/api";
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
  const { id, slug } = route.params;

  const [card, setCard] = useState<Card | null>(null);
  const [reviewsData, setReviewsData] = useState<CardReviewsResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
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
    actionButton: {
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: 8,
      alignItems: "center" as const,
      marginBottom: 12,
    } as const,
    actionButtonText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "600" as const,
    } as const,
    reviewSummary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    } as const,
    reviewSummaryText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    } as const,
    starsRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 2,
    } as const,
    starText: {
      fontSize: 24,
      color: colors.warning,
    } as const,
    starMuted: {
      color: colors.textMuted,
    } as const,
    reviewCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    } as const,
    reviewTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
      marginTop: 8,
      marginBottom: 4,
    } as const,
    reviewComment: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    } as const,
    reviewMeta: {
      fontSize: 12,
      color: colors.textMuted,
    } as const,
    emptyReviews: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: 12,
    } as const,
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      fontSize: 16,
      color: colors.text,
    } as const,
    textArea: {
      minHeight: 88,
      textAlignVertical: "top" as const,
    } as const,
    disabledButton: {
      backgroundColor: colors.textMuted,
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

  const loadReviews = useCallback(async (cardId: number) => {
    setReviewsLoading(true);
    try {
      const data = await apiClient.getCardReviews(cardId, { limit: 10 });
      setReviewsData(data);
    } catch (err) {
      logger.error("Error loading reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const loadCardDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const cardData = await apiClient.getCardBySlug(id, slug);
      setCard(cardData);
      await loadReviews(cardData.id);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load business details";
      setError(errorMessage);
      logger.error("Error loading business details:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id, loadReviews, slug]);

  useEffect(() => {
    loadCardDetails();
  }, [loadCardDetails]);

  const ensureHttpUrl = (value: string) =>
    /^https?:\/\//i.test(value) ? value : `https://${value}`;

  const getSocialUrl = (
    service: "facebook" | "instagram" | "twitter",
    value: string
  ) => {
    const trimmedValue = value.trim();
    if (/^https?:\/\//i.test(trimmedValue)) {
      return trimmedValue;
    }
    if (trimmedValue.includes(".")) {
      return ensureHttpUrl(trimmedValue);
    }

    const handle = trimmedValue.replace(/^@/, "");
    const host = service === "twitter" ? "twitter.com" : `${service}.com`;
    return `https://${host}/${encodeURIComponent(handle)}`;
  };

  const handleContactPress = (type: string, value: string) => {
    let url = "";
    const trimmedValue = value.trim();

    switch (type) {
      case "address":
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          trimmedValue
        )}`;
        break;
      case "phone":
        url = `tel:${trimmedValue.replace(/[^\d+]/g, "")}`;
        break;
      case "email":
        url = `mailto:${trimmedValue}`;
        break;
      case "website":
        url = ensureHttpUrl(trimmedValue);
        break;
      case "facebook":
        url = getSocialUrl("facebook", trimmedValue);
        break;
      case "instagram":
        url = getSocialUrl("instagram", trimmedValue);
        break;
      case "twitter":
        url = getSocialUrl("twitter", trimmedValue);
        break;
      default:
        return;
    }

    Linking.openURL(url).catch((err) => {
      logger.error("Error opening business detail link:", err);
      Alert.alert("Error", "Cannot open this link");
    });
  };

  const renderStars = (rating: number, interactive = false) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => interactive && setReviewRating(star)}
          disabled={!interactive || isSubmittingReview}
        >
          <Text
            style={[
              styles.starText,
              star > rating && styles.starMuted,
            ]}
          >
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const getReviewerName = (review: Review) => {
    if (!review.user) {
      return "Community member";
    }
    return `${review.user.first_name} ${review.user.last_name}`;
  };

  const handleSubmitReview = async () => {
    if (!card) {
      return;
    }

    if (reviewRating < 1) {
      Alert.alert("Rating Required", "Please choose a rating before submitting.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      await apiClient.createCardReview(card.id, {
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim() || undefined,
      });
      setReviewRating(0);
      setReviewTitle("");
      setReviewComment("");
      await loadReviews(card.id);
      Alert.alert("Review Submitted", "Thanks for sharing your feedback.");
    } catch (err) {
      Alert.alert(
        "Review Failed",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setIsSubmittingReview(false);
    }
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contribute</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate("BusinessForm", { mode: "edit", card })
            }
          >
            <Text style={styles.actionButtonText}>Suggest an Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          <View style={styles.reviewSummary}>
            {renderStars(Math.round(reviewsData?.summary.average_rating ?? 0))}
            <Text style={styles.reviewSummaryText}>
              {reviewsData?.summary.total_reviews
                ? `${reviewsData.summary.average_rating.toFixed(1)} average from ${
                    reviewsData.summary.total_reviews
                  } reviews`
                : "No reviews yet"}
            </Text>
          </View>

          {reviewsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : reviewsData?.reviews.length ? (
            reviewsData.reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                {renderStars(review.rating)}
                {review.title ? (
                  <Text style={styles.reviewTitle}>{review.title}</Text>
                ) : null}
                {review.comment ? (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                ) : null}
                <Text style={styles.reviewMeta}>
                  {getReviewerName(review)} -{" "}
                  {new Date(review.created_date).toLocaleDateString()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyReviews}>
              Be the first person to review this business.
            </Text>
          )}

          <Text style={styles.sectionTitle}>Write a Review</Text>
          {renderStars(reviewRating, true)}
          <TextInput
            style={styles.input}
            value={reviewTitle}
            onChangeText={setReviewTitle}
            placeholder="Review title (optional)"
            placeholderTextColor={colors.textMuted}
            editable={!isSubmittingReview}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={reviewComment}
            onChangeText={setReviewComment}
            placeholder="Share details about your experience (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!isSubmittingReview}
          />
          <TouchableOpacity
            style={[
              styles.actionButton,
              isSubmittingReview && styles.disabledButton,
            ]}
            onPress={handleSubmitReview}
            disabled={isSubmittingReview}
          >
            {isSubmittingReview ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.actionButtonText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
