"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiClient, ForumCategory } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { useConfig } from "@/contexts/ConfigContext";

export default function NewThreadPage() {
  const params = useParams();
  const router = useRouter();
  const categorySlug = params["categorySlug"] as string;
  const config = useConfig();
  const siteTitle = config.site.title;

  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    if (!apiClient.isAuthenticated()) {
      router.push(`/login?redirect=/forums/${categorySlug}/new`);
      return;
    }
    loadCategory();
  }, [categorySlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCategory = async () => {
    try {
      const categoryData = await apiClient.getForumCategory(categorySlug);
      setCategory(categoryData);
    } catch (error) {
      console.error("Failed to load category:", error);
      // If unauthorized, redirect to login
      if ((error as Error & { status?: number }).status === 401) {
        router.push(`/login?redirect=/forums/${categorySlug}/new`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const thread = await apiClient.createForumThread(categorySlug, {
        title: title.trim(),
        content: content.trim(),
      });
      router.push(`/forums/${categorySlug}/${thread.id}`);
    } catch (error) {
      console.error("Failed to create thread:", error);
      alert("Failed to create thread. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation currentPage="Forums" siteTitle={siteTitle} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Category not found
            </h1>
            <Link
              href="/forums"
              className="mt-4 inline-block text-blue-600 hover:text-blue-700"
            >
              ← Back to Forums
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
          <Link
            href={`/forums/${categorySlug}`}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {category.name}
          </Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-900 dark:text-white">New Thread</span>
        </nav>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Create New Thread in {category.name}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Thread Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter a descriptive title for your thread"
                required
                maxLength={200}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {title.length}/200 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Content
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Write your post content here..."
                required
              />
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Markdown supported:</span>{" "}
                **bold**, *italic*, `code`, ```code block```, [link](url), #
                heading, - list, &gt; quote
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting || !title.trim() || !content.trim()}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? "Creating..." : "Create Thread"}
              </button>
              <Link
                href={`/forums/${categorySlug}`}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-center font-medium"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Forum Guidelines
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>• Be respectful and courteous to other community members</li>
            <li>
              • Stay on topic and keep discussions relevant to the category
            </li>
            <li>
              • Do not post spam, advertisements, or inappropriate content
            </li>
            <li>
              • Use the report feature if you see content that violates these
              guidelines
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
