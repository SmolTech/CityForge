"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, HelpWantedPost } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

export default function HelpWantedPage() {
  const [posts, setPosts] = useState<HelpWantedPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<HelpWantedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [siteConfig, setSiteConfig] = useState<{
    shortName: string;
    title: string;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadPosts();
    loadSiteConfig();
  }, [categoryFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterPosts();
  }, [posts, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSiteConfig = async () => {
    try {
      const response = await fetch("/api/config");
      if (response.ok) {
        const config = await response.json();
        setSiteConfig({
          shortName: config.site?.shortName || "Community",
          title: config.site?.title || "Community Website",
        });
      }
    } catch (error) {
      logger.error("Failed to load site config:", error);
      setSiteConfig({
        shortName: "Community",
        title: "Community Website",
      });
    }
  };

  const loadPosts = async () => {
    try {
      const response = await apiClient.getHelpWantedPosts(
        categoryFilter === "all" ? undefined : categoryFilter,
        statusFilter === "all" ? undefined : statusFilter
      );
      setPosts(response.posts);
    } catch (error) {
      logger.error("Failed to load help wanted posts:", error);
      // Check if it's an auth error (401)
      if ((error as Error & { status?: number }).status === 401) {
        router.push("/login?redirect=/classifieds");
      }
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    if (!searchQuery.trim()) {
      setFilteredPosts(posts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(query) ||
        post.description.toLowerCase().includes(query) ||
        post.location?.toLowerCase().includes(query) ||
        post.budget?.toLowerCase().includes(query) ||
        (post.creator?.first_name + " " + post.creator?.last_name)
          .toLowerCase()
          .includes(query)
    );
    setFilteredPosts(filtered);
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "hiring":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "collaboration":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === "open"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
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
      <Navigation
        currentPage="Classifieds"
        siteTitle={siteConfig?.title || "Community Website"}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Classifieds
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {siteConfig?.shortName || "Community"} members looking for help,
                collaborators, or offering opportunities
              </p>
            </div>
            <Link
              href="/classifieds/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
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
              Post Request
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, description, location, budget, or poster..."
                className="block w-full pl-10 pr-3 py-2 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg
                    className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="hiring">Hiring</option>
                <option value="collaboration">Collaboration</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        {searchQuery && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Found {filteredPosts.length} result
            {filteredPosts.length !== 1 ? "s" : ""} for &quot;{searchQuery}
            &quot;
          </div>
        )}

        {/* Posts List */}
        {filteredPosts.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {searchQuery ? "No matching posts found" : "No posts found"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? "Try adjusting your search terms or filters"
                : "Be the first to post a classified request!"}
            </p>
            {!searchQuery && (
              <div className="mt-6">
                <Link
                  href="/classifieds/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Post Request
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <Link
                key={post.id}
                href={`/classifieds/${post.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeColor(post.category)}`}
                        >
                          {post.category.charAt(0).toUpperCase() +
                            post.category.slice(1)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(post.status)}`}
                        >
                          {post.status.charAt(0).toUpperCase() +
                            post.status.slice(1)}
                        </span>
                        {post.report_count > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <svg
                              className="h-3 w-3 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            {post.report_count}{" "}
                            {post.report_count === 1 ? "report" : "reports"}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {post.title}
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {post.description}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        {post.location && (
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
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            {post.location}
                          </span>
                        )}
                        {post.budget && (
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
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {post.budget}
                          </span>
                        )}
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
                          {post.comment_count} comments
                        </span>
                        <span>
                          Posted by {post.creator?.first_name}{" "}
                          {post.creator?.last_name} •{" "}
                          {new Date(post.created_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
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
