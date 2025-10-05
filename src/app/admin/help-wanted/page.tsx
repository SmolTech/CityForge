"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, User, HelpWantedReport, HelpWantedPost } from "@/lib/api";
import Navigation from "@/components/Navigation";

export default function AdminHelpWantedPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"reports" | "all-posts">(
    "reports"
  );
  const [reports, setReports] = useState<HelpWantedReport[]>([]);
  const [posts, setPosts] = useState<HelpWantedPost[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);
  const [processingReport, setProcessingReport] = useState<number | null>(null);
  const [showResolveModal, setShowResolveModal] =
    useState<HelpWantedReport | null>(null);
  const [resolveAction, setResolveAction] = useState<"dismiss" | "delete_post">(
    "dismiss"
  );
  const [resolveNotes, setResolveNotes] = useState("");
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      if (activeTab === "reports") {
        loadReports();
      } else {
        loadPosts();
      }
    }
  }, [activeTab, user]);

  const checkAuth = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        router.push("/login");
        return;
      }

      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.user.role !== "admin") {
        router.push("/");
        return;
      }

      setUser(userResponse.user);
      setLoading(false);
    } catch (error) {
      console.error("Failed to authenticate:", error);
      router.push("/login");
    }
  };

  const loadReports = async () => {
    try {
      const response = await apiClient.adminGetHelpWantedReports("pending");
      setReports(response.reports);
      setTotalReports(response.total);
    } catch (error) {
      console.error("Failed to load reports:", error);
    }
  };

  const loadPosts = async () => {
    try {
      const response = await apiClient.adminGetHelpWantedPosts();
      setPosts(response.posts);
      setTotalPosts(response.total);
    } catch (error) {
      console.error("Failed to load posts:", error);
    }
  };

  const handleResolveReport = async () => {
    if (!showResolveModal) return;

    setProcessingReport(showResolveModal.id);
    try {
      await apiClient.adminResolveHelpWantedReport(
        showResolveModal.id,
        resolveAction,
        resolveNotes || undefined
      );
      setShowResolveModal(null);
      setResolveNotes("");
      setResolveAction("dismiss");
      loadReports();
    } catch (error) {
      console.error("Failed to resolve report:", error);
      alert("Failed to resolve report. Please try again.");
    } finally {
      setProcessingReport(null);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this post? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await apiClient.adminDeleteHelpWantedPost(postId);
      loadPosts();
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post. Please try again.");
    }
  };

  const getReportReasonBadge = (reason: string) => {
    const colors = {
      spam: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      inappropriate:
        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      misleading:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return colors[reason as keyof typeof colors] || colors.other;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Admin" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Help Wanted Administration
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Manage reports and moderate help wanted posts
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("reports")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "reports"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Pending Reports ({totalReports})
            </button>
            <button
              onClick={() => setActiveTab("all-posts")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "all-posts"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              All Posts ({totalPosts})
            </button>
          </nav>
        </div>

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {reports.length === 0 ? (
              <div className="p-12 text-center">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No pending reports
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  All reports have been reviewed.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {reports.map((report) => (
                  <div key={report.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getReportReasonBadge(report.reason)}`}
                          >
                            {report.reason.charAt(0).toUpperCase() +
                              report.reason.slice(1)}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Reported by {report.reporter?.first_name}{" "}
                            {report.reporter?.last_name}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            •{" "}
                            {new Date(report.created_date).toLocaleDateString()}
                          </span>
                        </div>
                        {report.details && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                            <span className="font-medium">Details:</span>{" "}
                            {report.details}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Reported Post */}
                    {report.post && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeColor(report.post.category)}`}
                          >
                            {report.post.category.charAt(0).toUpperCase() +
                              report.post.category.slice(1)}
                          </span>
                          {report.post.report_count > 1 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              {report.post.report_count} reports
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {report.post.title}
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">
                          {report.post.description}
                        </p>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Posted by {report.post.creator?.first_name}{" "}
                          {report.post.creator?.last_name} •{" "}
                          {new Date(
                            report.post.created_date
                          ).toLocaleDateString()}
                        </div>
                        <Link
                          href={`/help-wanted/${report.post.id}`}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mt-2 inline-block"
                        >
                          View full post →
                        </Link>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowResolveModal(report)}
                        disabled={processingReport === report.id}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {processingReport === report.id
                          ? "Processing..."
                          : "Resolve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Posts Tab */}
        {activeTab === "all-posts" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {posts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No help wanted posts yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {posts.map((post) => (
                  <div key={post.id} className="p-6">
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
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              post.status === "open"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {post.status.charAt(0).toUpperCase() +
                              post.status.slice(1)}
                          </span>
                          {post.report_count > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              {post.report_count}{" "}
                              {post.report_count === 1 ? "report" : "reports"}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {post.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {post.description}
                        </p>
                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Posted by {post.creator?.first_name}{" "}
                          {post.creator?.last_name} •{" "}
                          {new Date(post.created_date).toLocaleDateString()} •{" "}
                          {post.comment_count} comments
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <Link
                          href={`/help-wanted/${post.id}`}
                          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="px-3 py-1 text-sm border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Resolve Report Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Resolve Report
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Action
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="action"
                    value="dismiss"
                    checked={resolveAction === "dismiss"}
                    onChange={(e) =>
                      setResolveAction(
                        e.target.value as "dismiss" | "delete_post"
                      )
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Dismiss report (keep post)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="action"
                    value="delete_post"
                    checked={resolveAction === "delete_post"}
                    onChange={(e) =>
                      setResolveAction(
                        e.target.value as "dismiss" | "delete_post"
                      )
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Delete the reported post
                  </span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={3}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Add any notes about this resolution..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowResolveModal(null);
                  setResolveNotes("");
                  setResolveAction("dismiss");
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveReport}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Resolve Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
