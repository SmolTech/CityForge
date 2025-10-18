"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient, ForumThread, ForumPost, ForumCategory } from "@/lib/api";
import Navigation from "@/components/Navigation";
import { useConfig } from "@/contexts/ConfigContext";

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const categorySlug = params["categorySlug"] as string;
  const threadId = parseInt(params["threadId"] as string);
  const config = useConfig();
  const siteTitle = config.site.title;

  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [reportingPostId, setReportingPostId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    if (!apiClient.isAuthenticated()) {
      router.push(`/login?redirect=/forums/${categorySlug}/${threadId}`);
      return;
    }
    loadData();
    loadCurrentUser();
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCurrentUser = async () => {
    try {
      const { user } = await apiClient.getCurrentUser();
      setCurrentUserId(user.id);
    } catch {
      // User not logged in
      setCurrentUserId(null);
    }
  };

  const loadData = async () => {
    try {
      const [categoryData, threadData] = await Promise.all([
        apiClient.getForumCategory(categorySlug),
        apiClient.getForumThread(threadId),
      ]);

      setCategory(categoryData);
      setThread(threadData);
      setPosts(threadData.posts || []);
    } catch (error) {
      console.error("Failed to load thread data:", error);
      // If unauthorized, redirect to login
      if ((error as Error & { status?: number }).status === 401) {
        router.push(`/login?redirect=/forums/${categorySlug}/${threadId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !thread) return;

    setSubmitting(true);
    try {
      await apiClient.createForumPost(thread.id, replyContent);
      setReplyContent("");
      await loadData();
    } catch (error) {
      console.error("Failed to create post:", error);
      alert("Failed to create post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPost = async (postId: number) => {
    if (!editContent.trim()) return;

    try {
      await apiClient.updateForumPost(postId, editContent);
      setEditingPostId(null);
      setEditContent("");
      await loadData();
    } catch (error) {
      console.error("Failed to update post:", error);
      alert("Failed to update post. Please try again.");
    }
  };

  const confirmDeletePost = async () => {
    if (!deletingPostId) return;

    try {
      await apiClient.deleteForumPost(deletingPostId);
      setDeletingPostId(null);
      await loadData();
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post. Please try again.");
    }
  };

  const handleReportThread = async () => {
    if (!reportReason || !thread) return;

    try {
      await apiClient.reportForumThread(
        thread.id,
        reportReason as
          | "spam"
          | "inappropriate"
          | "harassment"
          | "off_topic"
          | "other",
        reportDetails
      );
      setReportingPostId(null);
      setReportReason("");
      setReportDetails("");
      alert("Thread reported successfully. Moderators will review it.");
    } catch (error) {
      console.error("Failed to report thread:", error);
      alert("Failed to report thread. Please try again.");
    }
  };

  const handleReportPost = async (postId: number) => {
    if (!reportReason) return;

    try {
      await apiClient.reportForumPost(
        postId,
        reportReason as
          | "spam"
          | "inappropriate"
          | "harassment"
          | "off_topic"
          | "other",
        reportDetails
      );
      setReportingPostId(null);
      setReportReason("");
      setReportDetails("");
      alert("Post reported successfully. Moderators will review it.");
    } catch (error) {
      console.error("Failed to report post:", error);
      alert("Failed to report post. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!thread || !category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation currentPage="Forums" siteTitle={siteTitle} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Thread not found
            </h1>
            <Link
              href="/forums"
              className="mt-4 inline-block text-blue-600 hover:text-blue-700"
            >
              ← Back to Forums
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Forums" siteTitle={siteTitle} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm">
          <Link
            href="/forums"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Forums
          </Link>
          <span className="mx-2 text-gray-500">/</span>
          <Link
            href={`/forums/${categorySlug}`}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {category.name}
          </Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-900 dark:text-white">{thread.title}</span>
        </nav>

        {/* Thread Header */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {thread.is_pinned && (
                  <svg
                    className="h-5 w-5 text-yellow-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L11 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c-.25.78.409 1.57 1.214 1.46.333-.045.663-.123.985-.235.22-.077.421-.22.525-.424.098-.186.126-.4.016-.594L5.9 10.274z" />
                  </svg>
                )}
                {thread.is_locked && (
                  <svg
                    className="h-5 w-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                )}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {thread.title}
                </h1>
              </div>
              {thread.is_locked && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This thread has been locked and no new replies can be posted.
                </p>
              )}
            </div>
            {currentUserId && reportingPostId !== -1 && (
              <button
                onClick={() => setReportingPostId(-1)}
                className="ml-4 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Report Thread
              </button>
            )}
          </div>
        </div>

        {/* Report Thread Modal */}
        {reportingPostId === -1 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Report Thread
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select a reason</option>
                    <option value="spam">Spam</option>
                    <option value="harassment">Harassment</option>
                    <option value="inappropriate">Inappropriate content</option>
                    <option value="off_topic">Off-topic</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Details (optional)
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Additional information..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleReportThread}
                    disabled={!reportReason}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Submit Report
                  </button>
                  <button
                    onClick={() => {
                      setReportingPostId(null);
                      setReportReason("");
                      setReportDetails("");
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="space-y-4 mb-8">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                    {post.creator?.first_name?.[0]}
                    {post.creator?.last_name?.[0]}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {post.creator?.first_name} {post.creator?.last_name}
                    </span>
                    {post.is_first_post && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Original Post
                      </span>
                    )}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(post.created_date).toLocaleString()}
                    </span>
                    {post.edited_date && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        (edited)
                      </span>
                    )}
                  </div>

                  {editingPostId === post.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">
                          Markdown supported:
                        </span>{" "}
                        **bold**, *italic*, `code`, ```code block```,
                        [link](url), # heading, - list, &gt; quote
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPost(post.id)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingPostId(null);
                            setEditContent("");
                          }}
                          className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {post.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {currentUserId &&
                    editingPostId !== post.id &&
                    !thread.is_locked && (
                      <div className="mt-4 flex gap-4 text-sm">
                        {currentUserId === post.creator_id &&
                          !post.is_first_post && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingPostId(post.id);
                                  setEditContent(post.content);
                                }}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingPostId(post.id)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        {currentUserId !== post.creator_id && (
                          <button
                            onClick={() => setReportingPostId(post.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            Report
                          </button>
                        )}
                      </div>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Report Post Modal */}
        {reportingPostId && reportingPostId !== -1 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Report Post
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select a reason</option>
                    <option value="spam">Spam</option>
                    <option value="harassment">Harassment</option>
                    <option value="inappropriate">Inappropriate content</option>
                    <option value="off_topic">Off-topic</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Details (optional)
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Additional information..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReportPost(reportingPostId)}
                    disabled={!reportReason}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Submit Report
                  </button>
                  <button
                    onClick={() => {
                      setReportingPostId(null);
                      setReportReason("");
                      setReportDetails("");
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Post Confirmation Modal */}
        {deletingPostId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Delete Post
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete this post? This action cannot be
                undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDeletePost}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Delete Post
                </button>
                <button
                  onClick={() => setDeletingPostId(null)}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reply Form */}
        {currentUserId && !thread.is_locked ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Post a Reply
            </h3>
            <form onSubmit={handleReply}>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Write your reply..."
                required
              />
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Markdown supported:</span>{" "}
                **bold**, *italic*, `code`, ```code block```, [link](url), #
                heading, - list, &gt; quote
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !replyContent.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {submitting ? "Posting..." : "Post Reply"}
                </button>
              </div>
            </form>
          </div>
        ) : !currentUserId ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You must be logged in to reply to this thread.
            </p>
            <Link
              href="/login"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Log In
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}
