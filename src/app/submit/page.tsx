"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiClient } from "@/lib/api";
import { Navigation, EmailVerificationBanner } from "@/components/shared";
import { TagInput } from "@/components/filters";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

export default function SubmitPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    website_url: "",
    phone_number: "",
    email: "",
    address: "",
    address_override_url: "",
    image_url: "",
    tags_text: "",
  });
  const [tags, setTags] = useState<string[]>([]);

  const router = useRouter();

  useEffect(() => {
    // Authentication is handled by AuthContext, just mark loading as complete
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/login?redirect=/submit");
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, isAuthenticated, router]);

  // Remove the old loadData function since we're using AuthContext

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Filter out empty string values to send only populated fields
      const submissionData: Partial<typeof formData> & { name: string } = {
        name: formData.name,
      };

      // Only include optional fields if they have values
      if (formData.description)
        submissionData.description = formData.description;
      if (formData.website_url)
        submissionData.website_url = formData.website_url;
      if (formData.phone_number)
        submissionData.phone_number = formData.phone_number;
      if (formData.email) submissionData.email = formData.email;
      if (formData.address) submissionData.address = formData.address;
      if (formData.address_override_url) {
        submissionData.address_override_url = formData.address_override_url;
      }
      if (formData.image_url) submissionData.image_url = formData.image_url;
      if (tags.length > 0) submissionData.tags_text = tags.join(", ");

      await apiClient.submitCard(submissionData as typeof formData);
      setSuccess(true);
      setFormData({
        name: "",
        description: "",
        website_url: "",
        phone_number: "",
        email: "",
        address: "",
        address_override_url: "",
        image_url: "",
        tags_text: "",
      });
      setTags([]);
    } catch (err: unknown) {
      // Extract specific error message from API response
      let errorMessage = "Failed to submit content. Please try again.";

      if (err && typeof err === "object" && "message" in err) {
        const apiError = err as {
          message?: string;
          errors?: Record<string, string[]>;
        };

        // Handle validation errors with specific field messages
        if (apiError.errors && typeof apiError.errors === "object") {
          const fieldErrors = Object.entries(apiError.errors)
            .map(([field, messages]) => {
              const fieldName = field
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());
              return `${fieldName}: ${Array.isArray(messages) ? messages.join(", ") : messages}`;
            })
            .join("; ");

          errorMessage = `Validation failed: ${fieldErrors}`;
        }
        // Handle rate limiting
        else if (
          apiError.message?.includes("rate limit") ||
          apiError.message?.includes("Rate limit")
        ) {
          errorMessage =
            "You've submitted too many items recently. Please wait an hour and try again.";
        }
        // Handle authentication errors
        else if (
          apiError.message?.includes("expired") ||
          apiError.message?.includes("Unauthorized")
        ) {
          errorMessage = "Your session has expired. Please log in again.";
        }
        // Use generic API error message if available
        else if (apiError.message) {
          errorMessage = apiError.message;
        }
      }

      logger.error("Submission failed:", err);
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("Image is too large. Maximum file size is 10MB.");
      return;
    }

    // Validate file type
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError(
        "Invalid file type. Please upload a PNG, JPEG, GIF, or WebP image."
      );
      return;
    }

    setImageUploading(true);
    setError(""); // Clear any previous errors

    try {
      const response = await apiClient.uploadFile(file);
      setFormData({
        ...formData,
        image_url: response.url,
      });
    } catch (err: unknown) {
      let errorMessage = "Failed to upload image. Please try again.";

      if (err && typeof err === "object" && "message" in err) {
        const apiError = err as { message?: string };

        if (
          apiError.message?.includes("rate limit") ||
          apiError.message?.includes("Rate limit")
        ) {
          errorMessage =
            "You've uploaded too many images recently. Please wait and try again.";
        } else if (
          apiError.message?.includes("file type") ||
          apiError.message?.includes("File type")
        ) {
          errorMessage =
            "Invalid file type. Please upload a PNG, JPEG, GIF, or WebP image.";
        } else if (
          apiError.message?.includes("too large") ||
          apiError.message?.includes("size")
        ) {
          errorMessage = "Image is too large. Maximum file size is 10MB.";
        } else if (apiError.message) {
          errorMessage = apiError.message;
        }
      }

      logger.error("Image upload failed:", err);
      setError(errorMessage);
    } finally {
      setImageUploading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    router.push("/login?redirect=/submit");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Submit" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Email Verification Banner */}
        <EmailVerificationBanner className="mb-6" />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Submit Community Content
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Share information about local businesses, events, news, or services
            with the community. All submissions are reviewed by administrators
            before being published.
          </p>
        </div>

        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-200 px-4 py-3 rounded">
            <div className="flex">
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="font-medium">Submission successful!</h3>
                <p className="text-sm">
                  Your content has been submitted for review. You can track its
                  status in your dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Business name, event title, etc."
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Description
              </label>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Supports Markdown formatting (bold, italic, lists, links, etc.)
              </p>
              <textarea
                name="description"
                id="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="You can use **bold**, *italic*, bullet points, and more!"
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
                name="phone_number"
                id="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="(508) 555-0123"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="contact@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="website_url"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Website
                </label>
                <input
                  type="url"
                  name="website_url"
                  id="website_url"
                  value={formData.website_url}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://example.com"
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
                name="address"
                id="address"
                value={formData.address}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="123 Main St, City, State 01234"
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
                name="address_override_url"
                id="address_override_url"
                value={formData.address_override_url}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://custom-map-link.com or https://business-directions.com"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Provide a custom link for directions. The most common use case
                would be to linking to a business profile in Google Maps, rather
                than a search for the address.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <TagInput
                tags={tags}
                onChange={setTags}
                placeholder="restaurant, italian, downtown, family-friendly"
              />
            </div>

            <div>
              <label
                htmlFor="image"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Image (optional)
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={imageUploading}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {imageUploading && (
                  <div className="text-sm text-gray-500">Uploading...</div>
                )}
              </div>
              {formData.image_url && (
                <div className="mt-2">
                  <Image
                    src={formData.image_url}
                    alt="Uploaded preview"
                    width={80}
                    height={80}
                    className="object-cover rounded-md"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4">
              <Link
                href="/dashboard"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
