import { useState, useEffect } from "react";
import { Card as CardType, apiClient } from "@/lib/api";
import CardEditForm from "./CardEditForm";

interface Props {
  card: CardType;
}

export default function Card({ card }: Props) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const isAuthenticated = apiClient.isAuthenticated();

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDetailsModal) {
        setShowDetailsModal(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showDetailsModal]);

  const handleSuggestEdit = async (
    data: Partial<CardType & { tags: string[] }>
  ) => {
    setLoading(true);
    try {
      // Convert tags array back to comma-separated string
      const tags_text = data.tags?.join(", ") || "";
      const submitData = { ...data, tags_text };
      delete submitData.tags;

      await apiClient.suggestCardEdit(card.id, submitData);
      setShowEditForm(false);
      // Could add a toast notification here
    } catch (error) {
      console.error("Failed to suggest edit:", error);
      // Could add error handling here
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    if (card.share_url && typeof window !== "undefined") {
      return `${window.location.origin}${card.share_url}`;
    }
    return "";
  };

  const handleCopyLink = async () => {
    try {
      const shareUrl = getShareUrl();
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const shareOnTwitter = () => {
    const shareUrl = getShareUrl();
    const text = encodeURIComponent(`Check out ${card.name}!`);
    const url = encodeURIComponent(shareUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank"
    );
  };

  const shareOnFacebook = () => {
    const shareUrl = getShareUrl();
    const url = encodeURIComponent(shareUrl);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      "_blank"
    );
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === "A" ||
      target.tagName === "BUTTON" ||
      target.closest("button") ||
      target.closest("a")
    ) {
      return;
    }

    // Navigate to business detail page if share_url exists
    if (card.share_url) {
      window.location.href = card.share_url;
    }
  };

  return (
    <>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 cursor-pointer border border-gray-100 dark:border-slate-700 hover:scale-[1.02] hover:border-blue-200 dark:hover:border-blue-800"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
            {card.name}
          </h3>
          {card.featured && (
            <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md">
              ⭐ Featured
            </span>
          )}
        </div>

        {card.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
            {card.description}
          </p>
        )}

        <div className="space-y-2 mb-4">
          {card.address && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <svg
                className="w-4 h-4 mr-2"
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
              <a
                href={
                  card.address_override_url ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 dark:hover:text-blue-400"
              >
                {card.address}
              </a>
            </div>
          )}

          {card.phone_number && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <a
                href={`tel:${card.phone_number}`}
                className="hover:text-blue-600 dark:hover:text-blue-400"
              >
                {card.phone_number}
              </a>
            </div>
          )}

          {card.email && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <a
                href={`mailto:${card.email}`}
                className="hover:text-blue-600 dark:hover:text-blue-400"
              >
                {card.email}
              </a>
            </div>
          )}

          {card.website_url && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <a
                href={card.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 dark:hover:text-blue-400 truncate"
              >
                {card.website_url.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>

        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t dark:border-gray-700 pt-4 space-y-2">
          {/* Share button - only visible when share_url exists */}
          {card.share_url && (
            <div className="flex justify-end">
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowShareMenu(!showShareMenu);
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 border border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                    />
                  </svg>
                </button>

                {showShareMenu && (
                  <div className="absolute bottom-full mb-2 right-0 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50">
                    <div className="py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {copySuccess ? "✓ Copied!" : "Copy Link"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          shareOnTwitter();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Share on Twitter
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          shareOnFacebook();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Share on Facebook
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Suggest Edit button - only for authenticated users */}
          {isAuthenticated && (
            <button
              onClick={() => setShowEditForm(true)}
              className="w-full px-3 py-2 text-sm font-medium text-blue-600 hover:text-white dark:text-blue-400 dark:hover:text-white border border-blue-200 hover:border-blue-600 dark:border-blue-700 dark:hover:border-blue-500 rounded-lg hover:bg-blue-600 dark:hover:bg-blue-600 transition-all duration-200"
            >
              <svg
                className="w-4 h-4 inline mr-2"
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
              Suggest Edit
            </button>
          )}
        </div>

        {showEditForm && (
          <CardEditForm
            card={card}
            onSave={handleSuggestEdit}
            onCancel={() => setShowEditForm(false)}
            isAdmin={false}
            loading={loading}
          />
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowDetailsModal(false)}
          />
          <div
            className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {card.name}
                  </h2>
                  {card.featured && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        ⭐ Featured
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg
                    className="w-6 h-6"
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
              </div>

              {card.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Description
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                    {card.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Contact Information
                  </h3>
                  <div className="space-y-3">
                    {card.address && (
                      <div className="flex items-start">
                        <svg
                          className="w-5 h-5 mr-3 mt-0.5 text-gray-400"
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
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">
                            {card.address}
                          </p>
                          <a
                            href={
                              card.address_override_url ||
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                          >
                            View on Map →
                          </a>
                        </div>
                      </div>
                    )}

                    {card.phone_number && (
                      <div className="flex items-center">
                        <svg
                          className="w-5 h-5 mr-3 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <a
                          href={`tel:${card.phone_number}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {card.phone_number}
                        </a>
                      </div>
                    )}

                    {card.email && (
                      <div className="flex items-center">
                        <svg
                          className="w-5 h-5 mr-3 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <a
                          href={`mailto:${card.email}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {card.email}
                        </a>
                      </div>
                    )}

                    {card.website_url && (
                      <div className="flex items-center">
                        <svg
                          className="w-5 h-5 mr-3 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        <a
                          href={card.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {card.website_url.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {card.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isAuthenticated && (
                <div className="border-t dark:border-gray-700 pt-4">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setShowEditForm(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 hover:border-blue-300 dark:border-blue-700 dark:hover:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 inline mr-2"
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
                    Suggest Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close share menu */}
      {showShareMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowShareMenu(false)}
        />
      )}
    </>
  );
}
