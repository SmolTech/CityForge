"use client";

import { useState, useEffect, useCallback } from "react";
import StarRating from "./StarRating";
import { apiClient } from "@/lib/api";

export interface Review {
  id: number;
  card_id: number;
  rating: number;
  title?: string;
  comment?: string;
  hidden: boolean;
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
}

export default function ReviewDisplay({ cardId }: ReviewDisplayProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(
    null
  );
  const [reportReason, setReportReason] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  const loadReviews = useCallback(async () => {
    try {
      const response = await fetch(`/api/cards/${cardId}/reviews`);
      if (!response.ok) throw new Error("Failed to load reviews");
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error("Error loading reviews:", err);
      setError("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch(`/api/cards/${cardId}/reviews/summary`);
      if (!response.ok) throw new Error("Failed to load review summary");
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error("Error loading review summary:", err);
    }
  }, [cardId]);

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

  const handleReportReview = async (reviewId: number) => {
    if (!apiClient.isAuthenticated()) {
      alert("Please log in to report a review");
      return;
    }

    if (!reportReason.trim()) {
      alert("Please provide a reason for reporting this review");
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/reviews/${reviewId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ reason: reportReason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to report review");
      }

      setReportSuccess(true);
      setReportingReviewId(null);
      setReportReason("");

      setTimeout(() => {
        setReportSuccess(false);
      }, 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to report review");
    }
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
      {/* Report Success Message */}
      {reportSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <p className="text-green-700 dark:text-green-300">
            Thank you for reporting this review. An administrator will review
            it.
          </p>
        </div>
      )}

      {/* Review Summary */}
      {summary && summary.total_reviews > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {typeof summary.average_rating === "number"
                  ? summary.average_rating.toFixed(1)
                  : "0.0"}
              </h3>
              <StarRating
                rating={
                  typeof summary.average_rating === "number"
                    ? summary.average_rating
                    : 0
                }
                size="lg"
              />
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
                <div className="flex-1">
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
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(review.created_date)}
                  </span>
                  {apiClient.isAuthenticated() && (
                    <button
                      onClick={() => setReportingReviewId(review.id)}
                      className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      title="Report this review"
                    >
                      Report
                    </button>
                  )}
                </div>
              </div>

              {review.comment && (
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {review.comment}
                </p>
              )}

              {/* Report Form */}
              {reportingReviewId === review.id && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Report Review
                  </h5>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Please describe why this review should be reviewed..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white text-sm resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleReportReview(review.id)}
                      disabled={!reportReason.trim()}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Submit Report
                    </button>
                    <button
                      onClick={() => {
                        setReportingReviewId(null);
                        setReportReason("");
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
