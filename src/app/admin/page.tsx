"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";
import { AdminStatsCards } from "@/components/admin/AdminStatsCards";

interface DashboardStats {
  pendingSubmissions: number;
  pendingModifications: number;
  reportedReviews: number;
  pendingForumReports: number;
  pendingCategoryRequests: number;
  totalCards: number;
  totalUsers: number;
  totalTags: number;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    pendingSubmissions: 0,
    pendingModifications: 0,
    reportedReviews: 0,
    pendingForumReports: 0,
    pendingCategoryRequests: 0,
    totalCards: 0,
    totalUsers: 0,
    totalTags: 0,
  });
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();

        if (userResponse.user.role !== "admin") {
          router.push("/");
          return;
        }

        // Load dashboard stats
        await loadStats();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadStats = async () => {
    try {
      const [
        submissions,
        modifications,
        reviews,
        forumReports,
        categoryRequests,
        cards,
        users,
        tags,
      ] = await Promise.all([
        apiClient.adminGetSubmissions({ limit: 1000 }),
        apiClient.adminGetModifications({ limit: 1000 }),
        apiClient.adminGetReviews({ limit: 1000 }),
        apiClient.adminGetForumReports("pending"),
        apiClient.adminGetForumCategoryRequests(),
        apiClient.adminGetCards({ limit: 1 }),
        apiClient.adminGetUsers({ limit: 1 }),
        apiClient.getTags(),
      ]);

      setStats({
        pendingSubmissions:
          submissions.submissions?.filter(
            (s: { status: string }) => s.status === "pending"
          ).length || 0,
        pendingModifications:
          modifications.modifications?.filter(
            (m: { status: string }) => m.status === "pending"
          ).length || 0,
        reportedReviews:
          reviews.reviews?.filter((r: { reported: boolean }) => r.reported)
            .length || 0,
        pendingForumReports: forumReports.reports?.length || 0,
        pendingCategoryRequests:
          categoryRequests.requests?.filter(
            (r: { status: string }) => r.status === "pending"
          ).length || 0,
        totalCards: cards.total || 0,
        totalUsers: users.total || 0,
        totalTags: tags.length || 0,
      });
    } catch (error) {
      logger.error("Failed to load dashboard stats:", error);
    }
  };

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your community platform
          </p>
        </div>

        {/* Stats Overview */}
        <AdminStatsCards stats={stats} />

        {/* Priority Actions */}
        {(stats.pendingSubmissions > 0 ||
          stats.pendingModifications > 0 ||
          stats.reportedReviews > 0 ||
          stats.pendingForumReports > 0 ||
          stats.pendingCategoryRequests > 0) && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Needs Attention
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.pendingSubmissions > 0 && (
                <Link
                  href="/admin/submissions"
                  className="block bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Pending Submissions
                      </p>
                      <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                        {stats.pendingSubmissions}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center">
                      <svg
                        className="h-6 w-6 text-amber-600 dark:text-amber-400"
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
                    </div>
                  </div>
                </Link>
              )}

              {stats.pendingModifications > 0 && (
                <Link
                  href="/admin/modifications"
                  className="block bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        Pending Modifications
                      </p>
                      <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                        {stats.pendingModifications}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                      <svg
                        className="h-6 w-6 text-blue-600 dark:text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              )}

              {stats.reportedReviews > 0 && (
                <Link
                  href="/admin/reviews"
                  className="block bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        Reported Reviews
                      </p>
                      <p className="text-3xl font-bold text-red-900 dark:text-red-100 mt-1">
                        {stats.reportedReviews}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center">
                      <svg
                        className="h-6 w-6 text-red-600 dark:text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              )}

              {stats.pendingForumReports > 0 && (
                <Link
                  href="/admin/forums"
                  className="block bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        Forum Reports
                      </p>
                      <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                        {stats.pendingForumReports}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 dark:bg-orange-800 rounded-full flex items-center justify-center">
                      <svg
                        className="h-6 w-6 text-orange-600 dark:text-orange-400"
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
                    </div>
                  </div>
                </Link>
              )}

              {stats.pendingCategoryRequests > 0 && (
                <Link
                  href="/admin/forums"
                  className="block bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                        Category Requests
                      </p>
                      <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                        {stats.pendingCategoryRequests}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
                      <svg
                        className="h-6 w-6 text-purple-600 dark:text-purple-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Main Admin Sections */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Management
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Business Cards */}
            <Link
              href="/admin/cards"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Business Cards
                  </h3>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.totalCards}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage published business directory listings
              </p>
            </Link>

            {/* Submissions */}
            <Link
              href="/admin/submissions"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-green-600 dark:text-green-400"
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
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Submissions
                  </h3>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.pendingSubmissions}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Review and approve new card submissions
              </p>
            </Link>

            {/* Modifications */}
            <Link
              href="/admin/modifications"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-indigo-600 dark:text-indigo-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Modifications
                  </h3>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {stats.pendingModifications}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Review suggested edits to existing cards
              </p>
            </Link>

            {/* Users */}
            <Link
              href="/admin/users"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Users
                  </h3>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.totalUsers}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage user accounts and permissions
              </p>
            </Link>

            {/* Tags */}
            <Link
              href="/admin/tags"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-pink-600 dark:text-pink-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Tags
                  </h3>
                  <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                    {stats.totalTags}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage category tags and classifications
              </p>
            </Link>

            {/* Reviews */}
            <Link
              href="/admin/reviews"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Reviews
                  </h3>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.reportedReviews}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Moderate reported reviews and ratings
              </p>
            </Link>

            {/* Resources */}
            <Link
              href="/admin/resources"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-teal-600 dark:text-teal-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Resources
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage resource directory and quick access
              </p>
            </Link>

            {/* Forums */}
            <Link
              href="/admin/forums"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-orange-600 dark:text-orange-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Forums
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage forum categories and moderation
              </p>
            </Link>

            {/* Classifieds */}
            <Link
              href="/admin/classifieds"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-red-600 dark:text-red-400"
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
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Classifieds
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Moderate classified posts and reports
              </p>
            </Link>

            {/* Data Management */}
            <Link
              href="/admin/data"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-gray-600 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Data
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Import, export, and manage data
              </p>
            </Link>

            {/* Metrics Dashboard */}
            <Link
              href="/admin/metrics"
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-cyan-100 dark:bg-cyan-900 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-cyan-600 dark:text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Metrics
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Monitor platform usage and performance
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
