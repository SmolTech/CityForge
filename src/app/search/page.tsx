import React from "react";
import { Navigation } from "@/components/shared";
import { SearchInterface } from "@/components/search";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Search" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Local Web Search
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Find local resources, services, and information quickly and easily.
            These services are indexed from websites added to the directory.
          </p>
        </div>

        <SearchInterface />
      </main>
    </div>
  );
}
