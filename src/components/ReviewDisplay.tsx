"use client";

import { useState, useEffect, useCallback } from "react";
import StarRating from "./StarRating";

export interface Review {
  id: number;
  card_id: number;
  rating: number;
  title?: string;
  comment?: string;
  approved: boolean;
  created_date: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
  };
}

export interface ReviewSummary {
  card_id: number;
  total_reviews: number;
  average_rating: number | null;
  rating_distribution: Record<number, number>;
}

interface ReviewDisplayProps {
  cardId: number;
  apiUrl: string;
}

export default function ReviewDisplay({ cardId, apiUrl }: ReviewDisplayProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/cards/${cardId}/reviews`);
      if (!response.ok) throw new Error("Failed to load reviews");
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error("Error loading reviews:", err);
      setError("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, cardId]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiUrl}/api/cards/${cardId}/reviews/summary`
      );
      if (!response.ok) throw new Error("Failed to load review summary");
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error("Error loading review summary:", err);
    }
  }, [apiUrl, cardId]);

  useEffect(() => {
    loadReviews();
    loadSummary();
  }, [loadReviews, loadSummary]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Review Summary */}
      {summary && summary.total_reviews > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {summary.average_rating?.toFixed(1) || "0.0"}
              </h3>
              <StarRating rating={summary.average_rating || 0} size="lg" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Based on {summary.total_reviews} review
                {summary.total_reviews !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = summary.rating_distribution[rating] || 0;
                const percentage =
                  summary.total_reviews > 0
                    ? (count / summary.total_reviews) * 100
                    : 0;

                return (
                  <div key={rating} className="flex items-center text-sm">
                    <span className="w-8 text-gray-600 dark:text-gray-400">
                      {rating}★
                    </span>
                    <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mx-2">
                      <div
                        className="h-full bg-yellow-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-gray-600 dark:text-gray-400">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No reviews yet. Be the first to review this business!
          </p>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <StarRating rating={review.rating} size="sm" />
                    {review.user && (
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {review.user.first_name} {review.user.last_name}
                      </span>
                    )}
                  </div>
                  {review.title && (
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {review.title}
                    </h4>
                  )}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(review.created_date)}
                </span>
              </div>

              {review.comment && (
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {review.comment}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
