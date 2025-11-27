"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, Card } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { CardEditForm } from "@/components/cards";
import AdminCards from "@/components/admin/AdminCards";
import { logger } from "@/lib/logger";

export default function AdminCardsPage() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deletingCard, setDeletingCard] = useState<Card | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();

        if (userResponse.user.role !== "admin") {
          router.push("/");
          return;
        }

        await loadCards();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadCards = async () => {
    try {
      const response = await apiClient.adminGetCards({ limit: 1000 });
      setCards(response.cards || []);
    } catch (error) {
      logger.error("Failed to load cards:", error);
    }
  };

  const handleToggleFeatured = async (cardId: number, featured: boolean) => {
    try {
      await apiClient.adminUpdateCard(cardId, { featured });
      await loadCards();
    } catch (error) {
      logger.error("Failed to toggle featured status:", error);
    }
  };

  const handleSaveCard = async (cardData: Partial<Card>) => {
    if (!editingCard) return;

    try {
      await apiClient.adminUpdateCard(editingCard.id, cardData);
      setEditingCard(null);
      await loadCards();
    } catch (error) {
      logger.error("Failed to update card:", error);
    }
  };

  const handleDeleteCard = async () => {
    if (!deletingCard) return;

    try {
      await apiClient.adminDeleteCard(deletingCard.id);
      setDeletingCard(null);
      await loadCards();
    } catch (error) {
      logger.error("Failed to delete card:", error);
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
            <span className="text-gray-900 dark:text-white">
              Business Cards
            </span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Business Cards Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View, edit, and manage published business directory listings
          </p>
        </div>

        {/* Admin Cards Component */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <AdminCards
            cards={cards}
            onToggleFeatured={handleToggleFeatured}
            onEditCard={setEditingCard}
            onDeleteCard={setDeletingCard}
          />
        </div>
      </div>

      {/* Edit Card Modal */}
      {editingCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Edit Business Card
              </h2>
              <CardEditForm
                card={editingCard}
                onSave={handleSaveCard}
                onCancel={() => setEditingCard(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Confirm Delete
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete &quot;{deletingCard.name}&quot;?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingCard(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCard}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
