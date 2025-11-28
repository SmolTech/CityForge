"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Navigation } from "@/components/shared";
import AdminModifications from "@/components/admin/AdminModifications";
import { CardModification } from "@/lib/api";
import { logger } from "@/lib/logger";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export default function AdminModificationsPage() {
  const [loading, setLoading] = useState(true);
  const [modifications, setModifications] = useState<CardModification[]>([]);
  const [totalModifications, setTotalModifications] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [processingModification, setProcessingModification] = useState<
    number | null
  >(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedModification, setSelectedModification] = useState<
    number | null
  >(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const router = useRouter();

  const itemsPerPage = 20;

  const loadModifications = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await apiClient.adminGetModifications({
        status: statusFilter,
        limit: itemsPerPage,
        offset,
      });

      setModifications(response.modifications);
      setTotalModifications(response.total);
    } catch (error) {
      logger.error("Failed to load modifications:", error);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();

        if (userResponse.user.role !== "admin") {
          router.push("/");
          return;
        }

        await loadModifications();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, loadModifications]);

  useEffect(() => {
    if (!loading) {
      loadModifications();
    }
  }, [currentPage, statusFilter, loadModifications, loading]);

  const handleApprove = async (id: number) => {
    try {
      setProcessingModification(id);
      await apiClient.adminApproveModification(id);
      await loadModifications();
    } catch (error) {
      logger.error("Failed to approve modification:", error);
      alert("Failed to approve modification. Please try again.");
    } finally {
      setProcessingModification(null);
    }
  };

  const handleRejectClick = (id: number) => {
    setSelectedModification(id);
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedModification) return;

    try {
      setProcessingModification(selectedModification);
      await apiClient.adminRejectModification(
        selectedModification,
        rejectNotes
      );
      setShowRejectModal(false);
      setSelectedModification(null);
      setRejectNotes("");
      await loadModifications();
    } catch (error) {
      logger.error("Failed to reject modification:", error);
      alert("Failed to reject modification. Please try again.");
    } finally {
      setProcessingModification(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const totalPages = Math.ceil(totalModifications / itemsPerPage);

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
            <span className="text-gray-900 dark:text-white">Modifications</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit Suggestions
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Review and approve suggested edits to existing business cards
          </p>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <div className="sm:hidden">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setCurrentPage(1);
              }}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="hidden sm:block">
            <nav className="flex space-x-8">
              {["all", "pending", "approved", "rejected"].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status as StatusFilter);
                    setCurrentPage(1);
                  }}
                  className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm ${
                    statusFilter === status
                      ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}{" "}
                  {status === statusFilter && `(${totalModifications})`}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Modifications List */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <AdminModifications
            modifications={modifications}
            processingModification={processingModification}
            onApproveModification={handleApprove}
            onRejectModification={handleRejectClick}
            getStatusColor={getStatusColor}
          />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Showing{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, totalModifications)}
                  </span>{" "}
                  of <span className="font-medium">{totalModifications}</span>{" "}
                  results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === currentPage
                            ? "z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                            : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Reject Modification
              </h3>
              <div className="mt-4">
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Optional: Provide feedback for rejection..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                />
              </div>
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedModification(null);
                    setRejectNotes("");
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processingModification === selectedModification}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingModification === selectedModification
                    ? "Processing..."
                    : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
