"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiClient,
  User,
  ForumCategory,
  ForumCategoryRequest,
  ForumReport,
} from "@/lib/api";
import { Navigation } from "@/components/shared";

export default function AdminForumsPage() {
  const [, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    "categories" | "requests" | "reports"
  >("categories");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Categories state
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<ForumCategory | null>(
    null
  );
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  // Category requests state
  const [categoryRequests, setCategoryRequests] = useState<
    ForumCategoryRequest[]
  >([]);

  // Reports state
  const [reports, setReports] = useState<ForumReport[]>([]);
  const [reportsFilter, setReportsFilter] = useState<
    "all" | "pending" | "resolved"
  >("pending");

  // Delete confirmation state
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(
    null
  );

  // Reject request state
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const { user: currentUser } = await apiClient.getCurrentUser();
      if (currentUser.role !== "admin") {
        router.push("/");
        return;
      }
      setUser(currentUser);

      await Promise.all([
        loadCategories(),
        loadCategoryRequests(),
        loadReports(),
      ]);
    } catch (error) {
      console.error("Failed to load data:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await apiClient.adminGetForumCategories();
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadCategoryRequests = async () => {
    try {
      const { requests } = await apiClient.adminGetForumCategoryRequests();
      setCategoryRequests(requests);
    } catch (error) {
      console.error("Failed to load category requests:", error);
    }
  };

  const loadReports = async () => {
    try {
      const { reports: reportsData } =
        await apiClient.adminGetForumReports(reportsFilter);
      setReports(reportsData);
    } catch (error) {
      console.error("Failed to load reports:", error);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.adminCreateForumCategory(categoryForm);
      setShowAddCategory(false);
      setCategoryForm({
        name: "",
        description: "",
        display_order: 0,
        is_active: true,
      });
      await loadCategories();
    } catch (error) {
      console.error("Failed to create category:", error);
      alert("Failed to create category. Please try again.");
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    try {
      await apiClient.adminUpdateForumCategory(
        editingCategory.id,
        categoryForm
      );
      setEditingCategory(null);
      setCategoryForm({
        name: "",
        description: "",
        display_order: 0,
        is_active: true,
      });
      await loadCategories();
    } catch (error) {
      console.error("Failed to update category:", error);
      alert("Failed to update category. Please try again.");
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategoryId) return;

    try {
      await apiClient.adminDeleteForumCategory(deletingCategoryId);
      setDeletingCategoryId(null);
      await loadCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
      alert("Failed to delete category. Please try again.");
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    try {
      await apiClient.adminApproveForumCategoryRequest(requestId);
      await Promise.all([loadCategoryRequests(), loadCategories()]);
    } catch (error) {
      console.error("Failed to approve request:", error);
      alert("Failed to approve request. Please try again.");
    }
  };

  const confirmRejectRequest = async () => {
    if (!rejectingRequestId) return;

    try {
      await apiClient.adminRejectForumCategoryRequest(
        rejectingRequestId,
        rejectReason || undefined
      );
      setRejectingRequestId(null);
      setRejectReason("");
      await loadCategoryRequests();
    } catch (error) {
      console.error("Failed to reject request:", error);
      alert("Failed to reject request. Please try again.");
    }
  };

  const handlePinThread = async (threadId: number) => {
    try {
      await apiClient.adminPinForumThread(threadId);
      alert("Thread pinned successfully");
    } catch (error) {
      console.error("Failed to pin thread:", error);
      alert("Failed to pin thread. Please try again.");
    }
  };

  const handleLockThread = async (threadId: number) => {
    try {
      await apiClient.adminLockForumThread(threadId);
      alert("Thread locked successfully");
    } catch (error) {
      console.error("Failed to lock thread:", error);
      alert("Failed to lock thread. Please try again.");
    }
  };

  const handleResolveReport = async (reportId: number) => {
    try {
      await apiClient.adminResolveForumReport(reportId, "dismiss");
      await loadReports();
    } catch (error) {
      console.error("Failed to resolve report:", error);
      alert("Failed to resolve report. Please try again.");
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Forums Administration
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Manage forum categories, review requests, and handle reports
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("categories")}
              className={`${
                activeTab === "categories"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Categories
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`${
                activeTab === "requests"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Category Requests{" "}
              {categoryRequests.filter((r) => r.status === "pending").length >
                0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {
                    categoryRequests.filter((r) => r.status === "pending")
                      .length
                  }
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`${
                activeTab === "reports"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Reports{" "}
              {reports.filter((r) => r.status === "pending").length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {reports.filter((r) => r.status === "pending").length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Categories Tab */}
        {activeTab === "categories" && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Forum Categories
              </h2>
              <button
                onClick={() => setShowAddCategory(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
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
                Add Category
              </button>
            </div>

            {showAddCategory && (
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Add New Category
                </h3>
                <form onSubmit={handleCreateCategory} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={categoryForm.description}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={categoryForm.display_order}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            display_order: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={categoryForm.is_active}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            is_active: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="is_active"
                        className="ml-2 block text-sm text-gray-900 dark:text-white"
                      >
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Create Category
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCategory(false);
                        setCategoryForm({
                          name: "",
                          description: "",
                          display_order: 0,
                          is_active: true,
                        });
                      }}
                      className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {editingCategory && (
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Edit Category
                </h3>
                <form onSubmit={handleUpdateCategory} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={categoryForm.description}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={categoryForm.display_order}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            display_order: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="edit_is_active"
                        checked={categoryForm.is_active}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            is_active: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="edit_is_active"
                        className="ml-2 block text-sm text-gray-900 dark:text-white"
                      >
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Update Category
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryForm({
                          name: "",
                          description: "",
                          display_order: 0,
                          is_active: true,
                        });
                      }}
                      className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-4">
              {categories.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    No categories yet. Create one to get started.
                  </p>
                </div>
              ) : (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {category.name}
                          </h3>
                          {!category.is_active && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          {category.description}
                        </p>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <span>Order: {category.display_order}</span>
                          <span className="mx-2">•</span>
                          <span>{category.thread_count || 0} threads</span>
                          <span className="mx-2">•</span>
                          <span>{category.post_count || 0} posts</span>
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryForm({
                              name: category.name,
                              description: category.description,
                              display_order: category.display_order,
                              is_active: category.is_active,
                            });
                          }}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingCategoryId(category.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Category Requests Tab */}
        {activeTab === "requests" && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Category Requests
              </h2>
            </div>

            <div className="space-y-4">
              {categoryRequests.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    No category requests yet.
                  </p>
                </div>
              ) : (
                categoryRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {request.name}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              request.status === "pending"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                : request.status === "approved"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}
                          >
                            {request.status}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          {request.description}
                        </p>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 mb-2">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Justification:</strong>{" "}
                            {request.justification}
                          </p>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Requested by {request.requester?.first_name}{" "}
                          {request.requester?.last_name} on{" "}
                          {new Date(request.created_date).toLocaleDateString()}
                        </p>
                        {request.review_notes && (
                          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <strong>Review notes:</strong>{" "}
                            {request.review_notes}
                          </div>
                        )}
                      </div>
                      {request.status === "pending" && (
                        <div className="ml-4 flex gap-2">
                          <button
                            onClick={() => handleApproveRequest(request.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingRequestId(request.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Forum Reports
              </h2>
              <select
                value={reportsFilter}
                onChange={(e) => {
                  setReportsFilter(
                    e.target.value as "all" | "pending" | "resolved"
                  );
                  loadReports();
                }}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Reports</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    No reports to display.
                  </p>
                </div>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              report.post_id
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            }`}
                          >
                            {report.post_id ? "post" : "thread"}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              report.status === "pending"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            }`}
                          >
                            {report.status}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            {report.reason}
                          </span>
                        </div>
                        {report.thread && (
                          <Link
                            href={`/forums/${report.thread.category?.slug}/${report.thread.id}`}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold"
                          >
                            {report.thread.title}
                          </Link>
                        )}
                        {report.details && (
                          <p className="mt-2 text-gray-600 dark:text-gray-400">
                            <strong>Details:</strong> {report.details}
                          </p>
                        )}
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Reported by {report.reporter?.first_name}{" "}
                          {report.reporter?.last_name} on{" "}
                          {new Date(report.created_date).toLocaleDateString()}
                        </p>
                      </div>
                      {report.status === "pending" && (
                        <div className="ml-4 flex flex-col gap-2">
                          <button
                            onClick={() => handleResolveReport(report.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                          >
                            Resolve
                          </button>
                          {report.thread_id && (
                            <>
                              <button
                                onClick={() =>
                                  handlePinThread(report.thread_id!)
                                }
                                className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 text-sm"
                              >
                                Pin Thread
                              </button>
                              <button
                                onClick={() =>
                                  handleLockThread(report.thread_id!)
                                }
                                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
                              >
                                Lock Thread
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Delete Category Confirmation Modal */}
        {deletingCategoryId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Delete Category
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete this category? All threads and
                posts in this category will also be deleted. This action cannot
                be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDeleteCategory}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Delete Category
                </button>
                <button
                  onClick={() => setDeletingCategoryId(null)}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Category Request Modal */}
        {rejectingRequestId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Reject Category Request
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to reject this category request?
              </p>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for rejection (optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter a reason for the rejection..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmRejectRequest}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Reject Request
                </button>
                <button
                  onClick={() => {
                    setRejectingRequestId(null);
                    setRejectReason("");
                  }}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
