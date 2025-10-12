"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { iconComponents } from "@/lib/resources";
import { apiClient, User } from "@/lib/api";
import MarkdownContent from "./MarkdownContent";
import ReviewDisplay from "./ReviewDisplay";
import ReviewForm from "./ReviewForm";

interface Business {
  id: number;
  name: string;
  description?: string;
  website_url?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  address_override_url?: string;
  contact_name?: string;
  featured: boolean;
  image_url?: string;
  tags: string[];
  share_url: string;
  slug: string;
  created_date: string;
  creator?: User;
}

interface BusinessDetailProps {
  business: Business;
}

export default function BusinessDetail({ business }: BusinessDetailProps) {
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  const currentUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${business.share_url}`
      : "";

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        if (apiClient.isAuthenticated()) {
          const response = await apiClient.getCurrentUser();
          setCurrentUser(response.user);
        }
      } catch (error) {
        console.error("Failed to load current user:", error);
      }
    };

    loadCurrentUser();
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(
      `Check out ${business.name} on our community directory!`
    );
    const url = encodeURIComponent(currentUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank"
    );
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(currentUrl);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      "_blank"
    );
  };

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(currentUrl);
    const title = encodeURIComponent(business.name);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}`,
      "_blank"
    );
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Check out ${business.name}`);
    const body = encodeURIComponent(
      `I found this business in our community directory: ${currentUrl}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const getMapUrl = () => {
    if (business.address_override_url) {
      return business.address_override_url;
    }
    if (business.address) {
      return `https://maps.google.com/?q=${encodeURIComponent(business.address)}`;
    }
    return null;
  };

  // Get the first tag for icon (if any)
  const primaryTag = business.tags[0] || "business";
  const IconComponent = iconComponents[primaryTag] || iconComponents.business;

  // Check if current user is the owner of this business
  const isOwner =
    currentUser && business.creator && currentUser.id === business.creator.id;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm">
          <li>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Home
            </Link>
          </li>
          <li className="text-gray-500 dark:text-gray-400">/</li>
          <li className="text-gray-900 dark:text-white font-medium">
            {business.name}
          </li>
        </ol>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-8 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                {business.image_url ? (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden">
                    <Image
                      src={business.image_url}
                      alt={`${business.name} logo`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <IconComponent className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {business.name}
                </h1>
                {business.featured && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Featured
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              {/* Edit Button - Only shown to business owner */}
              {isOwner && (
                <Link
                  href={`/business/${business.id}/${business.slug}/edit`}
                  className="inline-flex items-center px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit
                </Link>
              )}

              {/* Share Button */}
              <div className="relative">
                <button
                  onClick={() => setShareMenuOpen(!shareMenuOpen)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
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
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                    />
                  </svg>
                  Share
                </button>

                {shareMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <button
                        onClick={handleCopyLink}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {copySuccess ? "✓ Copied!" : "Copy Link"}
                      </button>
                      <button
                        onClick={shareOnTwitter}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Share on Twitter
                      </button>
                      <button
                        onClick={shareOnFacebook}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Share on Facebook
                      </button>
                      <button
                        onClick={shareOnLinkedIn}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Share on LinkedIn
                      </button>
                      <button
                        onClick={shareViaEmail}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Share via Email
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {business.tags && business.tags.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {business.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Description */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                About
              </h2>
              {business.description ? (
                <div className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  <MarkdownContent content={business.description} />
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  No description available.
                </p>
              )}
            </div>

            {/* Contact Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Contact Information
              </h2>
              <div className="space-y-3">
                {business.contact_name && (
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span className="text-gray-900 dark:text-white">
                      {business.contact_name}
                    </span>
                  </div>
                )}

                {business.phone_number && (
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-3"
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
                      href={`tel:${business.phone_number}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      {business.phone_number}
                    </a>
                  </div>
                )}

                {business.email && (
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-3"
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
                      href={`mailto:${business.email}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      {business.email}
                    </a>
                  </div>
                )}

                {business.website_url && (
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 0V3m0 9h9m-9 0l3-3m-3 3l-3-3"
                      />
                    </svg>
                    <a
                      href={business.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Visit Website
                    </a>
                  </div>
                )}

                {business.address && (
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-3 mt-0.5"
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
                      <span className="text-gray-900 dark:text-white block">
                        {business.address}
                      </span>
                      {getMapUrl() && (
                        <a
                          href={getMapUrl()!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm mt-1 inline-block"
                        >
                          View on Map
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Reviews
          </h2>

          {/* Review Form */}
          <div className="mb-8">
            <ReviewForm
              cardId={business.id}
              onReviewSubmitted={() => setReviewRefreshKey((prev) => prev + 1)}
            />
          </div>

          {/* Reviews Display */}
          <div key={reviewRefreshKey}>
            <ReviewDisplay cardId={business.id} />
          </div>
        </div>
      </div>

      {/* Back to Directory */}
      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Directory
        </Link>
      </div>

      {/* Click outside to close share menu */}
      {shareMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShareMenuOpen(false)}
        />
      )}
    </main>
  );
}
