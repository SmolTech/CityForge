"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiClient,
  User,
  Card,
  CardSubmission,
  CardModification,
  Tag,
  CardsResponse,
  SubmissionsResponse,
  ModificationsResponse,
  QuickAccessItem,
  QuickAccessItemInput,
  ResourceItem,
  ResourceItemInput,
} from "@/lib/api";
import { CardEditForm } from "@/components/cards";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

export default function AdminPage() {
  const [, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "pending"
    | "cards"
    | "modifications"
    | "submissions"
    | "users"
    | "tags"
    | "resources"
    | "reviews"
  >("pending");
  const [loading, setLoading] = useState(true);
  const [siteTitle, setSiteTitle] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [submissions, setSubmissions] = useState<CardSubmission[]>([]);
  const [modifications, setModifications] = useState<CardModification[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [totalModifications, setTotalModifications] = useState(0);
  const [processingSubmission, setProcessingSubmission] = useState<
    number | null
  >(null);
  const [processingModification, setProcessingModification] = useState<
    number | null
  >(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deletingCard, setDeletingCard] = useState<Card | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<import("@/lib/api").AdminReview[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviewsFilter, setReviewsFilter] = useState<
    "all" | "reported" | "hidden"
  >("reported");

  // Resources state
  const [resourcesTab, setResourcesTab] = useState<"quick-access" | "items">(
    "quick-access"
  );
  const [quickAccessItems, setQuickAccessItems] = useState<QuickAccessItem[]>(
    []
  );
  const [editingQuickAccess, setEditingQuickAccess] =
    useState<QuickAccessItem | null>(null);
  const [showAddQuickAccess, setShowAddQuickAccess] = useState(false);
  const [resourceItems, setResourceItems] = useState<ResourceItem[]>([]);
  const [editingResourceItem, setEditingResourceItem] =
    useState<ResourceItem | null>(null);
  const [showAddResourceItem, setShowAddResourceItem] = useState(false);

  // Modal state for deletions and prompts
  const [deletingQuickAccessId, setDeletingQuickAccessId] = useState<
    number | null
  >(null);
  const [deletingResourceItemId, setDeletingResourceItemId] = useState<
    number | null
  >(null);
  const [rejectingSubmissionId, setRejectingSubmissionId] = useState<
    number | null
  >(null);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [hidingReviewId, setHidingReviewId] = useState<number | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);

  const router = useRouter();

  useEffect(() => {
    loadData();
    loadSiteConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSiteConfig = async () => {
    try {
      const response = await fetch("/api/config");
      if (response.ok) {
        const config = await response.json();
        setSiteTitle(config.site?.title || "");
      }
    } catch (error) {
      logger.error("Failed to load site config:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "cards") {
      loadCards();
    } else if (activeTab === "modifications") {
      loadModifications();
    } else if (activeTab === "submissions" || activeTab === "pending") {
      loadSubmissions();
    } else if (activeTab === "users") {
      loadUsers();
    } else if (activeTab === "tags") {
      loadTags();
    } else if (activeTab === "reviews") {
      loadReviews();
    } else if (activeTab === "resources") {
      loadResourcesData();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "reviews") {
      loadReviews();
    }
  }, [reviewsFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "resources") {
      if (resourcesTab === "quick-access") {
        loadQuickAccessItems();
      } else if (resourcesTab === "items") {
        loadResourceItems();
      }
    }
  }, [activeTab, resourcesTab]);

  const loadData = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        router.push("/login");
        return;
      }

      const userResponse = await apiClient.getCurrentUser();

      if (userResponse.user.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setUser(userResponse.user);
      await loadSubmissions(); // Load pending submissions by default
    } catch (error) {
      logger.error("Failed to load admin data:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadCards = async () => {
    try {
      const response: CardsResponse = await apiClient.adminGetCards({
        status: "all",
        limit: 50,
      });
      setCards(response.cards);
      setTotalCards(response.total);
    } catch (error) {
      logger.error("Failed to load cards:", error);
    }
  };

  const loadSubmissions = async () => {
    try {
      const status = activeTab === "pending" ? "pending" : "all";
      const response: SubmissionsResponse = await apiClient.adminGetSubmissions(
        {
          status: status as "pending" | "approved" | "rejected" | "all",
          limit: 50,
        }
      );
      setSubmissions(response.submissions);
      setTotalSubmissions(response.total);
    } catch (error) {
      logger.error("Failed to load submissions:", error);
    }
  };

  const loadModifications = async () => {
    try {
      const status = activeTab === "modifications" ? "pending" : "all";
      const response: ModificationsResponse =
        await apiClient.adminGetModifications({
          status: status as "pending" | "approved" | "rejected" | "all",
          limit: 50,
        });
      setModifications(response.modifications);
      setTotalModifications(response.total);
    } catch (error) {
      logger.error("Failed to load modifications:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiClient.adminGetUsers({
        page: currentPage,
        limit: 20,
        ...(searchQuery && { search: searchQuery }),
      });
      setUsers(response.users);
      setTotalUsers(response.total);
    } catch (error) {
      logger.error("Failed to load users:", error);
    }
  };

  const handleUpdateUser = async (userData: Partial<User>) => {
    if (!editingUser) return;
    try {
      await apiClient.adminUpdateUser(editingUser.id, userData);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      logger.error("Failed to update user:", error);
      alert("Failed to update user. Please try again.");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const result = await apiClient.adminDeleteUser(userId);
      setDeletingUser(null);
      await loadUsers();
      alert(result.message);
    } catch (error) {
      logger.error("Failed to delete user:", error);
      alert("Failed to delete user. Please try again.");
    }
  };

  const handleResetPassword = async (userId: number, newPassword: string) => {
    try {
      const result = await apiClient.adminResetUserPassword(
        userId,
        newPassword
      );
      setShowPasswordReset(null);
      alert(result.message);
    } catch (error) {
      logger.error("Failed to reset password:", error);
      alert("Failed to reset password. Please try again.");
    }
  };

  const loadTags = async () => {
    try {
      const tags = await apiClient.adminGetTags();
      setTags(tags);
    } catch (error) {
      logger.error("Failed to load tags:", error);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await apiClient.adminGetReviews({
        status: reviewsFilter,
        limit: 100,
        offset: 0,
      });
      setReviews(response.reviews);
      setTotalReviews(response.total);
    } catch (error) {
      logger.error("Failed to load reviews:", error);
    }
  };

  const handleHideReview = async (reviewId: number) => {
    try {
      await apiClient.adminHideReview(reviewId);
      setHidingReviewId(null);
      await loadReviews();
    } catch (error) {
      logger.error("Failed to hide review:", error);
      alert("Failed to hide review");
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    try {
      await apiClient.adminDeleteReview(reviewId);
      setDeletingReviewId(null);
      await loadReviews();
    } catch (error) {
      logger.error("Failed to delete review:", error);
      alert("Failed to delete review");
    }
  };

  const handleCreateTag = async (data: { name: string }) => {
    try {
      await apiClient.adminCreateTag(data);
      setShowAddTag(false);
      await loadTags();
    } catch (error) {
      logger.error("Failed to create tag:", error);
      alert("Failed to create tag. Please try again.");
    }
  };

  const handleUpdateTag = async (data: { name: string }) => {
    if (!editingTag) return;
    try {
      await apiClient.adminUpdateTag(editingTag.name, data);
      setEditingTag(null);
      await loadTags();
    } catch (error) {
      logger.error("Failed to update tag:", error);
      alert("Failed to update tag. Please try again.");
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    try {
      const result = await apiClient.adminDeleteTag(tagName);
      setDeletingTag(null);
      await loadTags();
      alert(result.message);
    } catch (error) {
      logger.error("Failed to delete tag:", error);
      alert("Failed to delete tag. Please try again.");
    }
  };

  // Resources handlers
  const loadResourcesData = async () => {
    if (resourcesTab === "quick-access") {
      await loadQuickAccessItems();
    } else if (resourcesTab === "items") {
      await loadResourceItems();
    }
  };

  const loadQuickAccessItems = async () => {
    try {
      const data = await apiClient.adminGetQuickAccessItems();
      setQuickAccessItems(data);
    } catch (error) {
      logger.error("Failed to load quick access items:", error);
    }
  };

  const loadResourceItems = async () => {
    try {
      const data = await apiClient.adminGetResourceItems();
      setResourceItems(data);
    } catch (error) {
      logger.error("Failed to load resource items:", error);
    }
  };

  const handleCreateQuickAccess = async (data: QuickAccessItemInput) => {
    try {
      await apiClient.adminCreateQuickAccessItem(data);
      setShowAddQuickAccess(false);
      await loadQuickAccessItems();
    } catch (error) {
      logger.error("Failed to create quick access item:", error);
    }
  };

  const handleUpdateQuickAccess = async (
    id: number,
    data: Partial<QuickAccessItemInput>
  ) => {
    try {
      await apiClient.adminUpdateQuickAccessItem(id, data);
      setEditingQuickAccess(null);
      await loadQuickAccessItems();
    } catch (error) {
      logger.error("Failed to update quick access item:", error);
    }
  };

  const handleDeleteQuickAccess = async (id: number) => {
    try {
      await apiClient.adminDeleteQuickAccessItem(id);
      setDeletingQuickAccessId(null);
      await loadQuickAccessItems();
    } catch (error) {
      logger.error("Failed to delete quick access item:", error);
    }
  };

  const handleCreateResourceItem = async (data: ResourceItemInput) => {
    try {
      await apiClient.adminCreateResourceItem(data);
      setShowAddResourceItem(false);
      await loadResourceItems();
    } catch (error) {
      logger.error("Failed to create resource item:", error);
    }
  };

  const handleUpdateResourceItem = async (
    id: number,
    data: Partial<ResourceItemInput>
  ) => {
    try {
      await apiClient.adminUpdateResourceItem(id, data);
      setEditingResourceItem(null);
      await loadResourceItems();
    } catch (error) {
      logger.error("Failed to update resource item:", error);
    }
  };

  const handleDeleteResourceItem = async (id: number) => {
    try {
      await apiClient.adminDeleteResourceItem(id);
      setDeletingResourceItemId(null);
      await loadResourceItems();
    } catch (error) {
      logger.error("Failed to delete resource item:", error);
    }
  };

  const handleApproveSubmission = async (
    submissionId: number,
    featured = false
  ) => {
    setProcessingSubmission(submissionId);
    try {
      await apiClient.adminApproveSubmission(submissionId, { featured });
      await loadSubmissions();
    } catch (error) {
      logger.error("Failed to approve submission:", error);
    } finally {
      setProcessingSubmission(null);
    }
  };

  const handleRejectSubmission = async (submissionId: number, notes = "") => {
    setProcessingSubmission(submissionId);
    try {
      await apiClient.adminRejectSubmission(submissionId, notes);
      await loadSubmissions();
    } catch (error) {
      logger.error("Failed to reject submission:", error);
    } finally {
      setProcessingSubmission(null);
    }
  };

  const handleToggleFeatured = async (cardId: number, featured: boolean) => {
    try {
      await apiClient.adminUpdateCard(cardId, { featured });
      await loadCards();
    } catch (error) {
      logger.error("Failed to update card:", error);
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    try {
      await apiClient.adminDeleteCard(cardId);
      setDeletingCard(null);
      await loadCards();
    } catch (error) {
      logger.error("Failed to delete card:", error);
      alert(
        `Failed to delete card: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleApproveModification = async (modificationId: number) => {
    setProcessingModification(modificationId);
    try {
      await apiClient.adminApproveModification(modificationId);
      await loadModifications();
      await loadCards(); // Reload cards to show updated data
    } catch (error) {
      logger.error("Failed to approve modification:", error);
    } finally {
      setProcessingModification(null);
    }
  };

  const handleRejectModification = async (
    modificationId: number,
    notes = ""
  ) => {
    setProcessingModification(modificationId);
    try {
      await apiClient.adminRejectModification(modificationId, notes);
      await loadModifications();
    } catch (error) {
      logger.error("Failed to reject modification:", error);
    } finally {
      setProcessingModification(null);
    }
  };

  const handleSaveCardEdit = async (
    cardData: Partial<Card & { tags: string[] }>
  ) => {
    if (!editingCard) return;

    try {
      await apiClient.adminUpdateCard(editingCard.id, cardData);
      setEditingCard(null);
      await loadCards();
    } catch (error) {
      logger.error("Failed to update card:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
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
      <Navigation currentPage="Admin" siteTitle={siteTitle} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage community content, review submissions, and moderate the
            platform.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Pending Review
                </h3>
                <p className="text-2xl font-bold text-yellow-600">
                  {submissions.filter((s) => s.status === "pending").length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-green-600"
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Published Cards
                </h3>
                <p className="text-2xl font-bold text-green-600">
                  {totalCards}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Total Submissions
                </h3>
                <p className="text-2xl font-bold text-blue-600">
                  {totalSubmissions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-orange-600"
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Modifications
                </h3>
                <p className="text-2xl font-bold text-orange-600">
                  {totalModifications}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-purple-600"
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Featured Cards
                </h3>
                <p className="text-2xl font-bold text-purple-600">
                  {cards.filter((c) => c.featured).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access - Classifieds */}
        <div className="mb-6">
          <Link
            href="/admin/classifieds"
            className="block bg-gradient-to-r from-red-500 to-orange-500 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-10 w-10 text-white"
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
                  <h3 className="text-xl font-bold text-white">
                    Classifieds Reports
                  </h3>
                  <p className="text-white text-opacity-90 text-sm">
                    Review and moderate classified posts and reports
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Access - Forums */}
        <div className="mb-6">
          <Link
            href="/admin/forums"
            className="block bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-10 w-10 text-white"
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
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-white">
                    Forums Management
                  </h3>
                  <p className="text-white text-opacity-90 text-sm">
                    Manage categories, category requests, and forum reports
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Access - Data Management */}
        <div className="mb-6">
          <Link
            href="/admin/data"
            className="block bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-10 w-10 text-white"
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
                  <h3 className="text-xl font-bold text-white">
                    Data Management
                  </h3>
                  <p className="text-white text-opacity-90 text-sm">
                    Export and import database data for backups and migrations
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === "pending"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Pending Submissions (
              {submissions.filter((s) => s.status === "pending").length})
            </button>
            <button
              onClick={() => setActiveTab("submissions")}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === "submissions"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              All Submissions
            </button>
            <button
              onClick={() => setActiveTab("modifications")}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === "modifications"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Modifications (
              {modifications.filter((m) => m.status === "pending").length})
            </button>
            <button
              onClick={() => setActiveTab("cards")}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === "cards"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Published Cards
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === "users"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === "tags"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Tags
            </button>
            <button
              onClick={() => setActiveTab("reviews")}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === "reviews"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Reviews
              {reviews.filter((r) => r.reported).length > 0 && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {reviews.filter((r) => r.reported).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("resources")}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === "resources"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Resources
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {(activeTab === "pending" || activeTab === "submissions") && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {submissions.length === 0 ? (
                <div className="p-6 text-center">
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
                    No submissions
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No submissions to review at this time.
                  </p>
                </div>
              ) : (
                submissions
                  .filter((s) =>
                    activeTab === "pending" ? s.status === "pending" : true
                  )
                  .map((submission) => (
                    <div key={submission.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                              {submission.name}
                            </h3>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}
                            >
                              {submission.status.charAt(0).toUpperCase() +
                                submission.status.slice(1)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                            <div>
                              <span className="font-medium">Submitted by:</span>{" "}
                              {submission.submitter?.first_name}{" "}
                              {submission.submitter?.last_name}
                            </div>
                            <div>
                              <span className="font-medium">Date:</span>{" "}
                              {new Date(
                                submission.created_date
                              ).toLocaleDateString()}
                            </div>
                            {submission.phone_number && (
                              <div>
                                <span className="font-medium">Phone:</span>{" "}
                                {submission.phone_number}
                              </div>
                            )}
                          </div>

                          {submission.description && (
                            <p className="text-gray-700 dark:text-gray-300 mb-3">
                              {submission.description}
                            </p>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {submission.email && (
                              <div>
                                <span className="font-medium text-gray-600 dark:text-gray-400">
                                  Email:
                                </span>
                                <div>{submission.email}</div>
                              </div>
                            )}
                            {submission.website_url && (
                              <div>
                                <span className="font-medium text-gray-600 dark:text-gray-400">
                                  Website:
                                </span>
                                <div>
                                  <a
                                    href={submission.website_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {submission.website_url}
                                  </a>
                                </div>
                              </div>
                            )}
                            {submission.address && (
                              <div>
                                <span className="font-medium text-gray-600 dark:text-gray-400">
                                  Address:
                                </span>
                                <div>{submission.address}</div>
                              </div>
                            )}
                          </div>

                          {submission.tags_text && (
                            <div className="mt-3">
                              <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                                Tags:
                              </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {submission.tags_text
                                  .split(",")
                                  .map((tag, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                    >
                                      {tag.trim()}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}

                          {submission.review_notes && (
                            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                              <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                                Review notes:
                              </span>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                {submission.review_notes}
                              </p>
                            </div>
                          )}
                        </div>

                        {submission.status === "pending" && (
                          <div className="ml-4 flex flex-col space-y-2">
                            <button
                              onClick={() =>
                                handleApproveSubmission(submission.id, false)
                              }
                              disabled={processingSubmission === submission.id}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                handleApproveSubmission(submission.id, true)
                              }
                              disabled={processingSubmission === submission.id}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded disabled:opacity-50"
                            >
                              Approve & Feature
                            </button>
                            <button
                              onClick={() => {
                                setRejectingSubmissionId(submission.id);
                                setRejectionNotes("");
                              }}
                              disabled={processingSubmission === submission.id}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded disabled:opacity-50"
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
          )}

          {activeTab === "cards" && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {cards.length === 0 ? (
                <div className="p-6 text-center">
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
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No cards
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No published cards found.
                  </p>
                </div>
              ) : (
                cards.map((card) => (
                  <div key={card.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {card.name}
                          </h3>
                          {card.featured && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Featured
                            </span>
                          )}
                        </div>

                        {card.description && (
                          <p className="text-gray-700 dark:text-gray-300 mb-3">
                            {card.description}
                          </p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {card.email && (
                            <div>
                              <span className="font-medium text-gray-600 dark:text-gray-400">
                                Email:
                              </span>
                              <div>{card.email}</div>
                            </div>
                          )}
                          {card.website_url && (
                            <div>
                              <span className="font-medium text-gray-600 dark:text-gray-400">
                                Website:
                              </span>
                              <div>
                                <a
                                  href={card.website_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {card.website_url}
                                </a>
                              </div>
                            </div>
                          )}
                          {card.address && (
                            <div>
                              <span className="font-medium text-gray-600 dark:text-gray-400">
                                Address:
                              </span>
                              <div>{card.address}</div>
                            </div>
                          )}
                        </div>

                        {card.tags.length > 0 && (
                          <div className="mt-3">
                            <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                              Tags:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {card.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          Created:{" "}
                          {new Date(card.created_date).toLocaleDateString()} •
                          Last updated:{" "}
                          {new Date(card.updated_date).toLocaleDateString()}
                          {card.creator && (
                            <>
                              {" "}
                              • Created by: {card.creator.first_name}{" "}
                              {card.creator.last_name}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col space-y-2">
                        <button
                          onClick={() =>
                            handleToggleFeatured(card.id, !card.featured)
                          }
                          className={`px-3 py-1 text-sm font-medium rounded ${
                            card.featured
                              ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                              : "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
                          }`}
                        >
                          {card.featured ? "Unfeature" : "Feature"}
                        </button>
                        <button
                          onClick={() => setEditingCard(card)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingCard(card)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "modifications" && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {modifications.length === 0 ? (
                <div className="p-6 text-center">
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No modifications
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No card modifications pending review.
                  </p>
                </div>
              ) : (
                modifications.map((modification) => (
                  <div key={modification.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {modification.name}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(modification.status)}`}
                          >
                            {modification.status.charAt(0).toUpperCase() +
                              modification.status.slice(1)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                          <div>
                            <span className="font-medium">Original Card:</span>{" "}
                            {modification.card?.name}
                          </div>
                          <div>
                            <span className="font-medium">Submitted by:</span>{" "}
                            {modification.submitter?.first_name}{" "}
                            {modification.submitter?.last_name}
                          </div>
                          <div>
                            <span className="font-medium">Date:</span>{" "}
                            {new Date(
                              modification.created_date
                            ).toLocaleDateString()}
                          </div>
                          {modification.card?.phone_number && (
                            <div>
                              <span className="font-medium">Phone:</span>{" "}
                              {modification.phone_number}
                            </div>
                          )}
                        </div>

                        {modification.description && (
                          <p className="text-gray-700 dark:text-gray-300 mb-3">
                            {modification.description}
                          </p>
                        )}

                        {modification.tags_text && (
                          <div className="mb-3">
                            <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                              Tags:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {modification.tags_text
                                .split(",")
                                .map((tag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                  >
                                    {tag.trim()}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}

                        {modification.review_notes && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-medium">Review notes:</span>{" "}
                              {modification.review_notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {modification.status === "pending" && (
                        <div className="ml-4 flex flex-col space-y-2">
                          <button
                            onClick={() =>
                              handleApproveModification(modification.id)
                            }
                            disabled={
                              processingModification === modification.id
                            }
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingModification === modification.id
                              ? "Processing..."
                              : "Approve"}
                          </button>
                          <button
                            onClick={() =>
                              handleRejectModification(modification.id)
                            }
                            disabled={
                              processingModification === modification.id
                            }
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingModification === modification.id
                              ? "Processing..."
                              : "Reject"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "users" && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Users
                </h2>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={loadUsers}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Search
                  </button>
                </div>
              </div>

              {users.length === 0 ? (
                <div className="text-center py-12">
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
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No users found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No users match your search criteria.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Joined
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {user.first_name} {user.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  user.role === "admin"
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  user.is_active
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                }`}
                              >
                                {user.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {new Date(user.created_date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                              <button
                                onClick={() => setEditingUser(user)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setShowPasswordReset(user)}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              >
                                Reset Password
                              </button>
                              <button
                                onClick={() => setDeletingUser(user)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalUsers > 20 && (
                    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 mt-4">
                      <div className="flex flex-1 justify-between sm:hidden">
                        <button
                          onClick={() =>
                            setCurrentPage(Math.max(1, currentPage - 1))
                          }
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage * 20 >= totalUsers}
                          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            Showing{" "}
                            <span className="font-medium">
                              {(currentPage - 1) * 20 + 1}
                            </span>{" "}
                            to{" "}
                            <span className="font-medium">
                              {Math.min(currentPage * 20, totalUsers)}
                            </span>{" "}
                            of <span className="font-medium">{totalUsers}</span>{" "}
                            results
                          </p>
                        </div>
                        <div>
                          <nav
                            className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                            aria-label="Pagination"
                          >
                            <button
                              onClick={() =>
                                setCurrentPage(Math.max(1, currentPage - 1))
                              }
                              disabled={currentPage === 1}
                              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0"
                            >
                              Previous
                            </button>
                            <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-600">
                              Page {currentPage}
                            </span>
                            <button
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={currentPage * 20 >= totalUsers}
                              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0"
                            >
                              Next
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "tags" && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Tags
                </h2>
                <button
                  onClick={() => setShowAddTag(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Add Tag
                </button>
              </div>

              {tags.length === 0 ? (
                <div className="text-center py-12">
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
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No tags
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get started by creating your first tag.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Tag Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Usage Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {tags.map((tag) => (
                        <tr key={tag.name}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                              {tag.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {tag.count} {tag.count === 1 ? "card" : "cards"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => setEditingTag(tag)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingTag(tag)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Reviews Management
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setReviewsFilter("reported")}
                    className={`px-4 py-2 text-sm font-medium rounded ${
                      reviewsFilter === "reported"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    Reported ({reviews.filter((r) => r.reported).length})
                  </button>
                  <button
                    onClick={() => setReviewsFilter("hidden")}
                    className={`px-4 py-2 text-sm font-medium rounded ${
                      reviewsFilter === "hidden"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    Hidden ({reviews.filter((r) => r.hidden).length})
                  </button>
                  <button
                    onClick={() => setReviewsFilter("all")}
                    className={`px-4 py-2 text-sm font-medium rounded ${
                      reviewsFilter === "all"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    All ({totalReviews})
                  </button>
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="text-center py-12">
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
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No reviews found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {reviewsFilter === "reported"
                      ? "No reported reviews at this time."
                      : reviewsFilter === "hidden"
                        ? "No hidden reviews."
                        : "No reviews in the system yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className={`border rounded-lg p-4 ${
                        review.reported
                          ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                          : review.hidden
                            ? "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
                            : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
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
                            {review.user && (
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {review.user.first_name} {review.user.last_name}
                              </span>
                            )}
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(
                                review.created_date
                              ).toLocaleDateString()}
                            </span>
                            {review.hidden && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                Hidden
                              </span>
                            )}
                            {review.reported && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200">
                                Reported
                              </span>
                            )}
                          </div>
                          {review.card && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Business: <strong>{review.card.name}</strong>
                            </div>
                          )}
                          {review.title && (
                            <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-1">
                              {review.title}
                            </h3>
                          )}
                          {review.comment && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                              {review.comment}
                            </p>
                          )}
                          {review.reported && review.reported_reason && (
                            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800">
                              <div className="flex items-start">
                                <svg
                                  className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 mt-0.5"
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
                                <div>
                                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                    Report Reason:
                                  </p>
                                  <p className="text-sm text-red-700 dark:text-red-300">
                                    {review.reported_reason}
                                  </p>
                                  {review.reporter && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                      Reported by: {review.reporter.first_name}{" "}
                                      {review.reporter.last_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col space-y-2 ml-4">
                          {!review.hidden && (
                            <button
                              onClick={() => setHidingReviewId(review.id)}
                              className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded"
                            >
                              Hide
                            </button>
                          )}
                          {review.hidden && (
                            <button
                              onClick={async () => {
                                try {
                                  await apiClient.adminUnhideReview(review.id);
                                  await loadReviews();
                                } catch {
                                  alert("Failed to unhide review");
                                }
                              }}
                              className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                            >
                              Unhide
                            </button>
                          )}
                          {review.reported && (
                            <button
                              onClick={async () => {
                                try {
                                  await apiClient.adminDismissReviewReport(
                                    review.id
                                  );
                                  await loadReviews();
                                } catch {
                                  alert("Failed to dismiss report");
                                }
                              }}
                              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                            >
                              Dismiss Report
                            </button>
                          )}
                          <button
                            onClick={() => setDeletingReviewId(review.id)}
                            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
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

          {activeTab === "resources" && (
            <div className="p-6">
              <div className="mb-4">
                <nav className="flex space-x-4">
                  <button
                    onClick={() => setResourcesTab("quick-access")}
                    className={`px-4 py-2 text-sm font-medium rounded ${
                      resourcesTab === "quick-access"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    Quick Access
                  </button>
                  <button
                    onClick={() => setResourcesTab("items")}
                    className={`px-4 py-2 text-sm font-medium rounded ${
                      resourcesTab === "items"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    Resource Items
                  </button>
                </nav>
              </div>

              {resourcesTab === "quick-access" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Quick Access Items
                    </h2>
                    <button
                      onClick={() => setShowAddQuickAccess(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Add Quick Access
                    </button>
                  </div>

                  {showAddQuickAccess && (
                    <QuickAccessForm
                      onSubmit={handleCreateQuickAccess}
                      onCancel={() => setShowAddQuickAccess(false)}
                    />
                  )}

                  {quickAccessItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 dark:border-gray-700 rounded p-4"
                    >
                      {editingQuickAccess?.id === item.id ? (
                        <QuickAccessForm
                          item={item}
                          onSubmit={(data) =>
                            handleUpdateQuickAccess(index + 1, data)
                          }
                          onCancel={() => setEditingQuickAccess(null)}
                        />
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {item.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.subtitle}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Phone: {item.phone}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              Color: {item.color} | Icon: {item.icon}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditingQuickAccess(item)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                setDeletingQuickAccessId(index + 1)
                              }
                              className="text-red-600 hover:text-red-800 dark:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {resourcesTab === "items" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Resource Items
                    </h2>
                    <button
                      onClick={() => setShowAddResourceItem(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Add Resource Item
                    </button>
                  </div>

                  {showAddResourceItem && (
                    <ResourceItemForm
                      onSubmit={handleCreateResourceItem}
                      onCancel={() => setShowAddResourceItem(false)}
                    />
                  )}

                  {resourceItems.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 dark:border-gray-700 rounded p-4"
                    >
                      {editingResourceItem?.id === item.id ? (
                        <ResourceItemForm
                          item={item}
                          onSubmit={(data) =>
                            handleUpdateResourceItem(item.id, data)
                          }
                          onCancel={() => setEditingResourceItem(null)}
                        />
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {item.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.description}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Category: {item.category}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              URL:{" "}
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {item.url}
                              </a>
                            </p>
                            {item.phone && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Phone: {item.phone}
                              </p>
                            )}
                            {item.address && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Address: {item.address}
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditingResourceItem(item)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingResourceItemId(item.id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Edit Card Modal */}
      {editingCard && (
        <CardEditForm
          card={editingCard}
          onSave={handleSaveCardEdit}
          onCancel={() => setEditingCard(null)}
          isAdmin={true}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingCard && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-4">
                Delete Card
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete{" "}
                  <strong>&quot;{deletingCard.name}&quot;</strong>? This action
                  cannot be undone.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setDeletingCard(null)}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteCard(deletingCard.id)}
                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          onSave={handleUpdateUser}
          onCancel={() => setEditingUser(null)}
        />
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <PasswordResetModal
          user={showPasswordReset}
          onReset={handleResetPassword}
          onCancel={() => setShowPasswordReset(null)}
        />
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-4">
                Delete User
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete{" "}
                  <strong>
                    {deletingUser.first_name} {deletingUser.last_name}
                  </strong>{" "}
                  ({deletingUser.email})?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {deletingUser.role === "admin" ? (
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Warning: This user is an admin!
                    </span>
                  ) : (
                    "This action may deactivate the user if they have submitted content."
                  )}
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setDeletingUser(null)}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(deletingUser.id)}
                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    {deletingUser.role === "admin"
                      ? "Delete Admin"
                      : "Delete User"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Tag Modal */}
      {showAddTag && (
        <TagFormModal
          onSave={handleCreateTag}
          onCancel={() => setShowAddTag(false)}
          title="Add Tag"
        />
      )}

      {/* Edit Tag Modal */}
      {editingTag && (
        <TagFormModal
          tag={editingTag}
          onSave={handleUpdateTag}
          onCancel={() => setEditingTag(null)}
          title="Edit Tag"
        />
      )}

      {/* Delete Tag Confirmation Modal */}
      {deletingTag && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-4">
                Delete Tag
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete the tag{" "}
                  <strong>&quot;{deletingTag.name}&quot;</strong>?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {deletingTag.count > 0 ? (
                    <span className="text-orange-600 dark:text-orange-400 font-medium">
                      Warning: This tag is used by {deletingTag.count}{" "}
                      {deletingTag.count === 1 ? "card" : "cards"}. Deleting it
                      will remove the tag from all cards.
                    </span>
                  ) : (
                    "This tag is not currently used by any cards."
                  )}
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setDeletingTag(null)}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteTag(deletingTag.name)}
                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    Delete Tag
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Quick Access Confirmation Modal */}
      {deletingQuickAccessId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Quick Access Item
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this quick access item? This
              action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingQuickAccessId(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteQuickAccess(deletingQuickAccessId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Resource Item Confirmation Modal */}
      {deletingResourceItemId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Resource Item
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this resource item? This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingResourceItemId(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteResourceItem(deletingResourceItemId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Submission Modal */}
      {rejectingSubmissionId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Reject Submission
            </h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rejection Reason (Optional)
              </label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter rejection reason..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setRejectingSubmissionId(null);
                  setRejectionNotes("");
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRejectSubmission(rejectingSubmissionId, rejectionNotes);
                  setRejectingSubmissionId(null);
                  setRejectionNotes("");
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hide Review Confirmation Modal */}
      {hidingReviewId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Hide Review
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to hide this review? It will no longer be
              visible to users but can be unhidden later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setHidingReviewId(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleHideReview(hidingReviewId)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Hide Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Review Confirmation Modal */}
      {deletingReviewId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Review
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to permanently delete this review? This
              action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingReviewId(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteReview(deletingReviewId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tag Form Modal Component
function TagFormModal({
  tag,
  onSave,
  onCancel,
  title,
}: {
  tag?: Tag;
  onSave: (data: { name: string }) => void;
  onCancel: () => void;
  title: string;
}) {
  const [formData, setFormData] = useState({
    name: tag?.name || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              {title}
            </h3>
            {tag && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Currently used by {tag.count}{" "}
                {tag.count === 1 ? "card" : "cards"}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Tag Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g. Restaurant, Shopping, Entertainment"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {tag ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// User Edit Modal Component
function UserEditModal({
  user,
  onSave,
  onCancel,
}: {
  user: User;
  onSave: (data: Partial<User>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    is_active: user.is_active,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Edit User
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {user.email}
            </p>
          </div>

          <div>
            <label
              htmlFor="first_name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              First Name
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="last_name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Last Name
            </label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Active
              </span>
            </label>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Update User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Password Reset Modal Component
function PasswordResetModal({
  user,
  onReset,
  onCancel,
}: {
  user: User;
  onReset: (userId: number, newPassword: string) => void;
  onCancel: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    onReset(user.id, newPassword);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Reset Password
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {user.first_name} {user.last_name} ({user.email})
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="new_password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              New Password
            </label>
            <input
              type="password"
              id="new_password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="confirm_password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirm_password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// QuickAccessForm Component
function QuickAccessForm({
  item,
  onSubmit,
  onCancel,
}: {
  item?: QuickAccessItem | null;
  onSubmit: (data: QuickAccessItemInput) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<QuickAccessItemInput>(
    item
      ? {
          identifier: "",
          title: item.title,
          subtitle: item.subtitle,
          phone: item.phone,
          color: item.color,
          icon: item.icon,
        }
      : {
          identifier: "",
          title: "",
          subtitle: "",
          phone: "",
          color: "blue",
          icon: "building",
          display_order: 0,
          is_active: true,
        }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 dark:border-gray-700 rounded p-4 space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Identifier
        </label>
        <input
          type="text"
          value={formData.identifier}
          onChange={(e) =>
            setFormData({ ...formData, identifier: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Subtitle
        </label>
        <input
          type="text"
          value={formData.subtitle}
          onChange={(e) =>
            setFormData({ ...formData, subtitle: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Phone
        </label>
        <input
          type="text"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Color
          </label>
          <select
            value={formData.color}
            onChange={(e) =>
              setFormData({ ...formData, color: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="purple">Purple</option>
            <option value="red">Red</option>
            <option value="orange">Orange</option>
            <option value="yellow">Yellow</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon
          </label>
          <input
            type="text"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {item ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ResourceItemForm Component
function ResourceItemForm({
  item,
  onSubmit,
  onCancel,
}: {
  item?: ResourceItem | null;
  onSubmit: (data: ResourceItemInput) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(
    item || {
      title: "",
      url: "",
      description: "",
      category: "",
      phone: "",
      address: "",
      icon: "building",
      display_order: 0,
      is_active: true,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 dark:border-gray-700 rounded p-4 space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          URL
        </label>
        <input
          type="url"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          rows={3}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Category
        </label>
        <input
          type="text"
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone (optional)
          </label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon
          </label>
          <input
            type="text"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Address (optional)
        </label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {item ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
