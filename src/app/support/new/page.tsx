"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, User } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

export default function NewSupportTicketPage() {
  const [, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "other" as const,
    priority: "normal" as const,
    is_anonymous: false,
  });

  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const userResponse = await apiClient.getCurrentUser();
      setUser(userResponse.user);
    } catch (error) {
      logger.error("Failed to load data:", error);
      if ((error as Error & { status?: number }).status === 401) {
        router.push("/login?redirect=/support/new");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const ticket = await apiClient.createTicket(formData);
      router.push(`/support/${ticket.id}`);
    } catch (err: unknown) {
      let errorMessage = "Failed to create support request. Please try again.";

      if (err && typeof err === "object" && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
      logger.error("Failed to create support ticket:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-[rgb(var(--background-rgb))] text-[rgb(var(--foreground-rgb))] pt-20 px-4">
          <div className="max-w-3xl mx-auto py-8">
            <p className="text-center">Loading...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[rgb(var(--background-rgb))] text-[rgb(var(--foreground-rgb))] pt-20 px-4">
        <div className="max-w-3xl mx-auto py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/support"
              className="text-blue-600 hover:underline mb-4 inline-block"
            >
              &larr; Back to Support Requests
            </Link>
            <h1 className="text-3xl font-bold mb-2">Request Support</h1>
            <p className="text-gray-600">
              Describe what help you need and our community supporters will
              reach out
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                Title <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief summary of your request"
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-2"
              >
                Description <span className="text-red-600">*</span>
              </label>
              <textarea
                id="description"
                required
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
                placeholder="Provide details about what help you need"
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="category"
                className="block text-sm font-medium mb-2"
              >
                Category <span className="text-red-600">*</span>
              </label>
              <select
                id="category"
                required
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as typeof formData.category,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="housing">Housing</option>
                <option value="food">Food</option>
                <option value="transportation">Transportation</option>
                <option value="healthcare">Healthcare</option>
                <option value="financial">Financial</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="mb-6">
              <label
                htmlFor="priority"
                className="block text-sm font-medium mb-2"
              >
                Priority
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as typeof formData.priority,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_anonymous}
                  onChange={(e) =>
                    setFormData({ ...formData, is_anonymous: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm">
                  Submit anonymously (your identity will be hidden from other
                  users, but visible to supporters)
                </span>
              </label>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
              <Link
                href="/support"
                className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
