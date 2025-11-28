"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, AdminTag, AdminApi } from "@/lib/api";
import { Navigation } from "@/components/shared";
import AdminTags from "@/components/admin/AdminTags";
import {
  AddTagModal,
  EditTagModal,
  DeleteTagModal,
} from "@/components/admin/TagModals";

export default function AdminTagsPage() {
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const router = useRouter();

  // Create admin API client instance
  const adminApi = useMemo(() => new AdminApi(), []);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTag, setEditingTag] = useState<AdminTag | null>(null);
  const [deletingTag, setDeletingTag] = useState<AdminTag | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Error and success message states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clear messages after a delay
  const clearMessages = () => {
    setTimeout(() => {
      setErrorMessage(null);
      setSuccessMessage(null);
    }, 5000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage(null);
    clearMessages();
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage(null);
    clearMessages();
  };

  const loadTags = useCallback(async () => {
    try {
      const response = await adminApi.getTags();
      setTags(response.tags);
      setLoadingError(null);
    } catch (error) {
      console.error("Error loading tags:", error);
      setLoadingError("Failed to load tags");
    }
  }, [adminApi]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();

        if (userResponse.user.role !== "admin") {
          router.push("/");
          return;
        }

        // Load tags after auth check passes
        await loadTags();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, loadTags]);

  const handleAddTag = async (name: string) => {
    setModalLoading(true);
    try {
      const response = await adminApi.createTag({ name });
      await loadTags(); // Refresh the list
      setShowAddModal(false);
      showSuccess(`Tag "${response.tag.name}" created successfully!`);
    } catch (error: unknown) {
      console.error("Error creating tag:", error);
      const message =
        (error as Error)?.message || "Failed to create tag. Please try again.";
      showError(message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditTag = async (id: number, name: string) => {
    setModalLoading(true);
    try {
      const response = await adminApi.updateTag(id, { name });
      await loadTags(); // Refresh the list
      setEditingTag(null);
      showSuccess(`Tag updated to "${response.tag.name}" successfully!`);
    } catch (error: unknown) {
      console.error("Error updating tag:", error);
      const message =
        (error as Error)?.message || "Failed to update tag. Please try again.";
      showError(message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteTag = async (id: number) => {
    setModalLoading(true);
    try {
      const response = await adminApi.deleteTag(id);
      await loadTags(); // Refresh the list
      setDeletingTag(null);
      showSuccess(response.message);
    } catch (error: unknown) {
      console.error("Error deleting tag:", error);
      const message =
        (error as Error)?.message || "Failed to delete tag. Please try again.";
      showError(message);
    } finally {
      setModalLoading(false);
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
            <span className="text-gray-900 dark:text-white">Tags</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Tag Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage category tags and business classifications
          </p>
        </div>

        {/* Error message */}
        {loadingError && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-red-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-300">
                {loadingError}
              </p>
              <button
                onClick={loadTags}
                className="ml-4 text-sm text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-green-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-green-700 dark:text-green-300">
                {successMessage}
              </p>
            </div>
          </div>
        )}

        {/* Error message for operations */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-red-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-300">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {/* Tags Management Component */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <AdminTags
            tags={tags}
            onShowAddTag={() => setShowAddModal(true)}
            onSetEditingTag={setEditingTag}
            onSetDeletingTag={setDeletingTag}
          />
        </div>
      </div>

      {/* Modals */}
      <AddTagModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onConfirm={handleAddTag}
        isLoading={modalLoading}
      />

      <EditTagModal
        isOpen={!!editingTag}
        tag={editingTag}
        onClose={() => setEditingTag(null)}
        onConfirm={handleEditTag}
        isLoading={modalLoading}
      />

      <DeleteTagModal
        isOpen={!!deletingTag}
        tag={deletingTag}
        onClose={() => setDeletingTag(null)}
        onConfirm={handleDeleteTag}
        isLoading={modalLoading}
      />
    </div>
  );
}
