"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Navigation } from "@/components/shared";

export default function AdminModificationsPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();

        if (userResponse.user.role !== "admin") {
          router.push("/");
          return;
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

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
            <span className="text-gray-900 dark:text-white">Modifications</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit Suggestions
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Review and approve suggested edits to existing business cards
          </p>
        </div>

        {/* Admin Modifications Component */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Modifications management interface will be implemented here.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            This page is under construction.
          </p>
        </div>
      </div>
    </div>
  );
}
