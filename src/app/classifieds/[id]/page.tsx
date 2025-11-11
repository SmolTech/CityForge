"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient, HelpWantedPost, HelpWantedComment, User } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

export default function HelpWantedDetailPage() {
  const [post, setPost] = useState<HelpWantedPost | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<
    "spam" | "inappropriate" | "misleading" | "other"
  >("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [showReportSuccess, setShowReportSuccess] = useState(false);
  const [reportError, setReportError] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(
    null
  );
  const [siteConfig, setSiteConfig] = useState<{
    title: string;
  } | null>(null);
  const router = useRouter();
  const params = useParams();
  const postId = parseInt(params["id"] as string);

  useEffect(() => {
    loadPost();
    loadSiteConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSiteConfig = async () => {
    try {
      const response = await fetch("/api/config");
      if (response.ok) {
        const config = await response.json();
        setSiteConfig({ title: config.site?.title || "Community Website" });
      }
    } catch (error) {
      logger.error("Failed to load site config:", error);
      setSiteConfig({ title: "Community Website" });
    }
  };

  const loadPost = async () => {
    try {
      const [postData, userData] = await Promise.all([
        apiClient.getHelpWantedPost(postId),
        apiClient.getCurrentUser(),
      ]);

      setPost(postData);
      setCurrentUser(userData.user);
    } catch (error) {
      logger.error("Failed to load post:", error);
      // Check if it's an auth error (401)
      if ((error as Error & { status?: number }).status === 401) {
        router.push("/login?redirect=/classifieds/" + postId);
      } else {
        router.push("/classifieds");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    try {
      await apiClient.createHelpWantedComment(
        postId,
        commentContent,
        replyTo || undefined
      );
      setCommentContent("");
      setReplyTo(null);
      loadPost(); // Reload to get new comments
    } catch (error) {
      logger.error("Failed to post comment:", error);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError("");
    try {
      await apiClient.reportHelpWantedPost(postId, reportReason, reportDetails);
      setShowReportModal(false);
      setReportDetails("");
      setReportReason("spam");
      setShowReportSuccess(true);
    } catch (error) {
      logger.error("Failed to report post:", error);
      setReportError(
        "Failed to submit report. You may have already reported this post."
      );
    }
  };

  const handleStatusToggle = async () => {
    if (!post || post.creator?.id !== currentUser?.id) return;

    try {
      const newStatus = post.status === "open" ? "closed" : "open";
      await apiClient.updateHelpWantedPost(postId, { status: newStatus });
      loadPost();
    } catch (error) {
      logger.error("Failed to update status:", error);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await apiClient.deleteHelpWantedComment(postId, commentId);
      setDeletingCommentId(null);
      loadPost();
    } catch (error) {
      logger.error("Failed to delete comment:", error);
    }
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

  const renderComment = (comment: HelpWantedComment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? "ml-12 mt-4" : "mb-6"}`}>
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">
              {comment.creator?.first_name} {comment.creator?.last_name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(comment.created_date).toLocaleString()}
            </span>
          </div>
          {comment.creator?.id === currentUser?.id && (
            <button
              onClick={() => setDeletingCommentId(comment.id)}
              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {comment.content}
        </p>
        {!isReply && (
          <button
            onClick={() => setReplyTo(comment.id)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Reply
          </button>
        )}
      </div>
      {comment.replies &&
        comment.replies.map((reply) => renderComment(reply, true))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        currentPage="Classifieds"
        siteTitle={siteConfig?.title || "Community Website"}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Post Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeColor(post.category)}`}
                >
                  {post.category.charAt(0).toUpperCase() +
                    post.category.slice(1)}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(post.status)}`}
                >
                  {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                </span>
                {post.report_count > 0 &&
                  (currentUser?.role === "admin" ||
                    post.creator?.id === currentUser?.id) && (
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {post.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  Posted by {post.creator?.first_name} {post.creator?.last_name}
                </span>
                <span>•</span>
                <span>{new Date(post.created_date).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {post.creator?.id === currentUser?.id && (
                <button
                  onClick={handleStatusToggle}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Mark as {post.status === "open" ? "Closed" : "Open"}
                </button>
              )}
              <button
                onClick={() => setShowReportModal(true)}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Report
              </button>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {post.description}
            </p>
          </div>

          {(post.location || post.budget) && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {post.location && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
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
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="font-medium mr-2">Location:</span>
                  {post.location}
                </div>
              )}
              {post.budget && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
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
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium mr-2">Budget:</span>
                  {post.budget}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Comments ({post.comments?.length || 0})
          </h2>

          {/* Comment Form */}
          <form onSubmit={handleComment} className="mb-6">
            {replyTo && (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Replying to comment
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Cancel
                </button>
              </div>
            )}
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 mb-2"
            />
            <button
              type="submit"
              disabled={!commentContent.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              Post Comment
            </button>
          </form>

          {/* Comments List */}
          <div>
            {post.comments && post.comments.length > 0 ? (
              post.comments.map((comment) => renderComment(comment))
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No comments yet. Be the first to comment!
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Report Post
            </h3>
            {reportError && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {reportError}
                </p>
              </div>
            )}
            <form onSubmit={handleReport}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason
                </label>
                <select
                  value={reportReason}
                  onChange={(e) =>
                    setReportReason(e.target.value as typeof reportReason)
                  }
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="spam">Spam</option>
                  <option value="inappropriate">Inappropriate Content</option>
                  <option value="misleading">Misleading Information</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Details (optional)
                </label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportError("");
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Success Modal */}
      {showReportSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-10 w-10 text-green-500"
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
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Report Submitted
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Thank you for helping keep our community safe. Admins will
                  review your report shortly.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowReportSuccess(false)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Comment Confirmation Modal */}
      {deletingCommentId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Comment
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this comment? This action cannot
              be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingCommentId(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteComment(deletingCommentId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
