"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { TagInput } from "@/components/filters";
import { logger } from "@/lib/logger";

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
  tags: string[];
}

interface SuggestEditModalProps {
  business: Business;
  isOpen: boolean;
  onClose: () => void;
}

export default function SuggestEditModal({
  business,
  isOpen,
  onClose,
}: SuggestEditModalProps) {
  const [formData, setFormData] = useState({
    name: business.name,
    description: business.description || "",
    website_url: business.website_url || "",
    phone_number: business.phone_number || "",
    email: business.email || "",
    address: business.address || "",
    address_override_url: business.address_override_url || "",
    contact_name: business.contact_name || "",
  });
  const [tags, setTags] = useState<string[]>(business.tags || []);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.name.trim()) {
      setError("Name is required");
      setLoading(false);
      return;
    }

    try {
      // Convert form data to API format expected by the suggest-edit endpoint
      const submitData = {
        name: formData.name.trim(),
        ...(formData.description.trim() && {
          description: formData.description.trim(),
        }),
        ...(formData.website_url.trim() && {
          websiteUrl: formData.website_url.trim(),
        }),
        ...(formData.phone_number.trim() && {
          phoneNumber: formData.phone_number.trim(),
        }),
        ...(formData.email.trim() && { email: formData.email.trim() }),
        ...(formData.address.trim() && { address: formData.address.trim() }),
        ...(formData.address_override_url.trim() && {
          addressOverrideUrl: formData.address_override_url.trim(),
        }),
        ...(formData.contact_name.trim() && {
          contactName: formData.contact_name.trim(),
        }),
        ...(tags.length > 0 && { tagsText: tags.join(", ") }),
      };

      await apiClient.suggestCardEdit(business.id, submitData);
      setSuccess(true);

      // Close modal after a short delay to show success message
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (error: unknown) {
      logger.error("Failed to submit suggestion:", error);

      // Type guard for error object with statusCode
      const apiError = error as {
        statusCode?: number;
        message?: { errors?: Record<string, string[]> };
      };

      // Handle rate limit and validation errors
      if (apiError.statusCode === 429) {
        setError(
          "You've reached the rate limit (10 suggestions per hour). Please try again later."
        );
      } else if (apiError.statusCode === 422 && apiError.message?.errors) {
        // Handle validation errors
        const validationErrors = Object.values(apiError.message.errors).flat();
        setError(validationErrors.join(". "));
      } else {
        setError("Failed to submit suggestion. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Suggest Edit
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={loading}
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

          {success ? (
            <div className="text-center py-8">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 text-green-600 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Suggestion Submitted!
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Thank you for your suggestion. It will be reviewed by our
                administrators.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md p-4 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Suggest improvements</strong> to this business
                  listing. Your changes will be reviewed by administrators
                  before being applied.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Description
                </label>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Supports Markdown formatting (bold, italic, lists, links,
                  etc.)
                </p>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="You can use **bold**, *italic*, bullet points, and more!"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="website_url"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Website
                  </label>
                  <input
                    type="url"
                    id="website_url"
                    name="website_url"
                    value={formData.website_url}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone_number"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact_name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Contact Name
                  </label>
                  <input
                    type="text"
                    id="contact_name"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Address
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="address_override_url"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Custom Address Link (optional)
                </label>
                <input
                  type="url"
                  id="address_override_url"
                  name="address_override_url"
                  value={formData.address_override_url}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://custom-map-link.com"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Provide a custom link for directions. If not provided, the
                  address will link to Google Maps.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tags
                </label>
                <TagInput
                  tags={tags}
                  onChange={setTags}
                  placeholder="restaurant, italian, downtown"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Submitting..." : "Submit Suggestion"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Click outside to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
