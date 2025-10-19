"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { useConfig } from "@/contexts/ConfigContext";

export default function RequestCategoryPage() {
  const router = useRouter();
  const config = useConfig();
  const siteTitle = config.site.title;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    if (!apiClient.isAuthenticated()) {
      router.push("/login?redirect=/forums/request-category");
      return;
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !justification.trim()) return;

    setSubmitting(true);
    try {
      await apiClient.requestForumCategory({
        name: name.trim(),
        description: description.trim(),
        justification: justification.trim(),
      });
      alert(
        "Category request submitted successfully! An administrator will review it."
      );
      router.push("/forums");
    } catch (error) {
      console.error("Failed to submit category request:", error);
      // If unauthorized, redirect to login
      if ((error as Error & { status?: number }).status === 401) {
        router.push("/login?redirect=/forums/request-category");
      } else {
        alert("Failed to submit category request. Please try again.");
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Forums" siteTitle={siteTitle} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm">
          <Link
            href="/forums"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Forums
          </Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-900 dark:text-white">
            Request Category
          </span>
        </nav>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Request a New Forum Category
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Suggest a new category for the community forums. Your request will
              be reviewed by administrators.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="e.g., Technology, Local Events, Health & Wellness"
                required
                maxLength={100}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {name.length}/100 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Briefly describe what this category would be used for..."
                required
                maxLength={500}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {description.length}/500 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="justification"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Explain why this category would benefit the community..."
                required
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Tell us why you think this category is needed and how it would
                be used.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !name.trim() ||
                  !description.trim() ||
                  !justification.trim()
                }
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
              <Link
                href="/forums"
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-center font-medium"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
            Before Requesting
          </h3>
          <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
            <li>
              • Check existing categories to see if your topic fits in an
              existing one
            </li>
            <li>
              • Make sure your proposed category has a clear, specific focus
            </li>
            <li>
              • Consider whether there will be enough interest and activity in
              this category
            </li>
            <li>
              • Be patient - administrators will review your request and may
              reach out with questions
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
