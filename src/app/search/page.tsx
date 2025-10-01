import React from "react";
import Navigation from "@/components/Navigation";
import SearchInterface from "@/components/SearchInterface";
import { loadAppConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  const appConfig = loadAppConfig();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Search" siteTitle={appConfig.site.title} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Search Resources
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Find local resources, services, and information quickly and easily
          </p>
        </div>

        <SearchInterface />
      </main>
    </div>
  );
}
