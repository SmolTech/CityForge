"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, AdminReview } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

export default function AdminReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [filter, setFilter] = useState<"all" | "reported" | "hidden">(
    "reported"
  );
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();

        if (userResponse.user.role !== "admin") {
          router.push("/");
          return;
        }

        await loadReviews();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadReviews = async () => {
    try {
      const response = await apiClient.adminGetReviews({ limit: 1000 });
      setReviews(response.reviews || []);
    } catch (error) {
      logger.error("Failed to load reviews:", error);
    }
  };

  const handleHideReview = async (reviewId: number) => {
    try {
      await apiClient.adminHideReview(reviewId);
      await loadReviews();
    } catch (error) {
      logger.error("Failed to hide review:", error);
    }
  };

  const handleShowReview = async (reviewId: number) => {
    try {
      await apiClient.adminUnhideReview(reviewId);
      await loadReviews();
    } catch (error) {
      logger.error("Failed to show review:", error);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm("Are you sure you want to permanently delete this review?")) {
      return;
    }

    try {
      await apiClient.adminDeleteReview(reviewId);
      await loadReviews();
    } catch (error) {
      logger.error("Failed to delete review:", error);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (filter === "reported") return review.reported;
    if (filter === "hidden") return review.hidden;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation currentPage="Admin" />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Admin" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with breadcrumb */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link
              href="/admin"
              className="hover:text-gray-700 dark:hover:text-gray-300"
            >
              Admin
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">Reviews</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Review Moderation
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Moderate reported reviews and manage review visibility
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            <button
              onClick={() => setFilter("reported")}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                filter === "reported"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Reported Reviews
              {reviews.filter((r) => r.reported).length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {reviews.filter((r) => r.reported).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter("hidden")}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                filter === "hidden"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Hidden Reviews ({reviews.filter((r) => r.hidden).length})
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                filter === "all"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              All Reviews ({reviews.length})
            </button>
          </nav>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {filteredReviews.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <p className="text-gray-500 dark:text-gray-400">
                No reviews to display
              </p>
            </div>
          ) : (
            filteredReviews.map((review) => (
              <div
                key={review.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Card #{review.card_id}
                      </h3>
                      {review.reported && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Reported
                        </span>
                      )}
                      {review.hidden && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        By{" "}
                        {review.user
                          ? `${review.user.first_name} ${review.user.last_name}`
                          : "Anonymous"}{" "}
                        on {new Date(review.created_date).toLocaleDateString()}
                      </span>
                      <span className="mx-2">•</span>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "text-yellow-400"
                                : "text-gray-300 dark:text-gray-600"
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {review.comment && (
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    {review.comment}
                  </p>
                )}

                <div className="flex items-center space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href={`/business/${review.card_id}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View Business Card
                  </Link>
                  {review.hidden ? (
                    <button
                      onClick={() => handleShowReview(review.id)}
                      className="text-sm text-green-600 dark:text-green-400 hover:underline"
                    >
                      Show Review
                    </button>
                  ) : (
                    <button
                      onClick={() => handleHideReview(review.id)}
                      className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Hide Review
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete Review
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
