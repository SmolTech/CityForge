"use client";

import React, { useEffect, useState, Suspense } from "react";
import Navigation from "@/components/Navigation";
import { apiClient } from "@/lib/api";
import { iconComponents, getColorClasses } from "@/lib/resources";
import { useConfig } from "@/contexts/ConfigContext";

interface ResourcesData {
  site: {
    title: string;
    description: string;
    domain: string;
  };
  title: string;
  description: string;
  quickAccess: Array<{
    id: string;
    title: string;
    subtitle: string;
    phone: string;
    color: string;
    icon: string;
  }>;
  resources: Array<{
    id: number;
    title: string;
    url: string;
    description: string;
    category: string;
    phone?: string;
    address?: string;
    icon: string;
  }>;
  footer: {
    title: string;
    description: string;
    contactEmail: string;
    buttonText: string;
  };
}

function ResourcesContent() {
  const config = useConfig();
  const siteConfig = config.site;
  const [resourcesData, setResourcesData] = useState<ResourcesData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteTitle, setSiteTitle] = useState(siteConfig.title);

  useEffect(() => {
    async function fetchResources() {
      try {
        setLoading(true);
        const data = await apiClient.getResources();
        setResourcesData(data);
        setSiteTitle(data.site.title);
      } catch (err) {
        console.error("Failed to fetch resources:", err);
        setError("Failed to load resources. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchResources();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation currentPage="Resources" siteTitle={siteTitle} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Loading resources...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !resourcesData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation currentPage="Resources" siteTitle={siteTitle} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">
              {error || "Failed to load resources"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const resourceConfig = resourcesData;
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Resources" siteTitle={siteConfig.title} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {resourceConfig.title}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {resourceConfig.description}
          </p>
        </div>

        {/* Quick Access Cards */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {resourceConfig.quickAccess.map((item) => (
            <div
              key={item.id}
              className={`bg-gradient-to-br ${getColorClasses(item.color)} text-white rounded-lg p-6 transition-all`}
            >
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-3">
                  {React.createElement(iconComponents[item.icon], {
                    className: "w-8 h-8",
                  })}
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className={`text-${item.color}-100 text-sm`}>
                  {item.subtitle}
                </p>
                {item.phone === "911" ? (
                  <p className="text-2xl font-bold mt-2">{item.phone}</p>
                ) : (
                  <a
                    href={`tel:${item.phone}`}
                    className="text-lg font-bold mt-2 block hover:underline"
                  >
                    {item.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Resource Categories */}
        {Array.from(
          new Set(resourceConfig.resources.map((resource) => resource.category))
        ).map((category) => (
          <div key={category} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {category}
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resourceConfig.resources
                .filter((resource) => resource.category === category)
                .map((resource) => (
                  <div
                    key={resource.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1">
                        {React.createElement(iconComponents[resource.icon], {
                          className: "w-6 h-6",
                        })}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {resource.title}
                          </a>
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 leading-relaxed">
                          {resource.description}
                        </p>
                        {resource.phone && (
                          <div className="mb-3">
                            <div className="inline-flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                              <svg
                                className="w-4 h-4 mr-1"
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
                              {resource.phone === "911" ? (
                                <span>{resource.phone}</span>
                              ) : (
                                <a
                                  href={`tel:${resource.phone}`}
                                  className="hover:underline"
                                >
                                  {resource.phone}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        {resource.address && (
                          <div className="mb-3">
                            <div className="inline-flex items-center text-purple-600 dark:text-purple-400 text-sm font-medium">
                              <svg
                                className="w-4 h-4 mr-1"
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
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resource.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {resource.address}
                              </a>
                            </div>
                          </div>
                        )}
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                        >
                          Visit website
                          <svg
                            className="w-4 h-4 ml-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}

        {/* Additional Information */}
        <div className="mt-16 bg-gray-100 dark:bg-gray-800 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {resourceConfig.footer.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              {resourceConfig.footer.description}
            </p>
            <a
              href={`mailto:${resourceConfig.footer.contactEmail}`}
              className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
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
              {resourceConfig.footer.buttonText}
            </a>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 dark:text-gray-400">
            {siteConfig && (
              <p>
                &copy; {siteConfig.copyright}{" "}
                <a href={siteConfig.copyrightUrl}>
                  {siteConfig.copyrightHolder}
                </a>
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function ResourcesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navigation currentPage="Resources" siteTitle="Loading..." />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Loading resources...
              </p>
            </div>
          </main>
        </div>
      }
    >
      <ResourcesContent />
    </Suspense>
  );
}
