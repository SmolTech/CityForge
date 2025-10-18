"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, ForumCategory } from "@/lib/api";
import Navigation from "@/components/Navigation";
import { useConfig } from "@/contexts/ConfigContext";

export default function ForumsPage() {
  const router = useRouter();
  const config = useConfig();
  const siteConfig = config.site;
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    if (!apiClient.isAuthenticated()) {
      router.push("/login?redirect=/forums");
      return;
    }
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      // Load categories with stats
      const categoriesData = await apiClient.getForumCategories(true);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Failed to load forums data:", error);
      // If unauthorized, redirect to login
      if ((error as Error & { status?: number }).status === 401) {
        router.push("/login?redirect=/forums");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Forums" siteTitle={siteConfig.title} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Community Forums
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Discuss topics, share ideas, and connect with the{" "}
                {siteConfig.shortName} community
              </p>
            </div>
            <Link
              href="/forums/request-category"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <svg
                className="h-5 w-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Request Category
            </Link>
          </div>
        </div>

        {/* Categories List */}
        {categories.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No forum categories yet
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Be the first to request a category!
            </p>
            <div className="mt-6">
              <Link
                href="/forums/request-category"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Request Category
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/forums/${category.slug}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {category.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {category.description}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center">
                          <svg
                            className="h-4 w-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                            />
                          </svg>
                          {category.thread_count || 0} thread
                          {category.thread_count !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center">
                          <svg
                            className="h-4 w-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                          {category.post_count || 0} post
                          {category.post_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {category.latest_thread && (
                      <div className="ml-6 text-right text-xs text-gray-500 dark:text-gray-400">
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          Latest: {category.latest_thread.title}
                        </div>
                        <div className="mt-1">
                          {new Date(
                            category.latest_thread.updated_date
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
