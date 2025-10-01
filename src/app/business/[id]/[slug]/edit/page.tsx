"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiClient, User, Card } from "@/lib/api";
import Navigation from "@/components/Navigation";
import TagInput from "@/components/TagInput";

export default function EditBusinessPage() {
  const params = useParams();
  const router = useRouter();
  const [, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Card | null>(null);
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
    contact_name: "",
    image_url: "",
    tags_text: "",
  });
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        router.push("/login");
        return;
      }

      const [userResponse, businessData] = await Promise.all([
        apiClient.getCurrentUser(),
        apiClient.getBusiness(Number(params.id), params.slug as string),
      ]);

      setUser(userResponse.user);
      setBusiness(businessData);

      // Check if user is the owner
      if (
        businessData.creator &&
        userResponse.user.id !== businessData.creator.id
      ) {
        router.push(`/business/${params.id}/${params.slug}`);
        return;
      }

      // Populate form with existing data
      setFormData({
        name: businessData.name || "",
        description: businessData.description || "",
        website_url: businessData.website_url || "",
        phone_number: businessData.phone_number || "",
        email: businessData.email || "",
        address: businessData.address || "",
        address_override_url: businessData.address_override_url || "",
        contact_name: businessData.contact_name || "",
        image_url: businessData.image_url || "",
        tags_text: businessData.tags?.join(", ") || "",
      });
      setTags(businessData.tags || []);
    } catch (error) {
      console.error("Failed to load data:", error);
      setError("Failed to load business data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await apiClient.suggestCardEdit(Number(params.id), {
        ...formData,
        tags_text: tags.join(", "),
      });
      setSuccess(true);
      setTimeout(() => {
        router.push(`/business/${params.id}/${params.slug}`);
      }, 2000);
    } catch {
      setError("Failed to submit edit suggestion. Please try again.");
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

    setImageUploading(true);
    try {
      const response = await apiClient.uploadFile(file);
      setFormData({
        ...formData,
        image_url: response.url,
      });
    } catch {
      setError("Failed to upload image. Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Business Not Found
          </h1>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Return to Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Edit Business" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
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
              <li>
                <Link
                  href={`/business/${params.id}/${params.slug}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  {business.name}
                </Link>
              </li>
              <li className="text-gray-500 dark:text-gray-400">/</li>
              <li className="text-gray-900 dark:text-white font-medium">
                Edit
              </li>
            </ol>
          </nav>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit {business.name}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Suggest changes to your business information. All edits must be
            approved by administrators before being published.
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
                <h3 className="font-medium">Edit suggestion submitted!</h3>
                <p className="text-sm">
                  Your changes have been submitted for review. You&apos;ll be
                  redirected back to your business page.
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
                  placeholder="Business name"
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
              <textarea
                name="description"
                id="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Provide details about your business..."
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
                name="contact_name"
                id="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Primary contact person"
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
                placeholder="https://custom-map-link.com"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Provide a custom link for directions, such as a Google Maps
                business profile.
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
                Business Image (optional)
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
                    alt="Business image preview"
                    width={80}
                    height={80}
                    className="object-cover rounded-md"
                  />
                </div>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Upload a logo or photo that represents your business.
              </p>
            </div>

            <div className="flex justify-end space-x-4">
              <Link
                href={`/business/${params.id}/${params.slug}`}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Changes for Review"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
