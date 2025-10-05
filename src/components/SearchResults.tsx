"use client";

import React from "react";

interface SearchResult {
  id: number;
  title: string;
  description: string;
  content_excerpt: string;
  url: string;
  page_url: string;
  category: string;
  phone: string;
  address: string;
  domain: string;
  score: number;
  is_homepage: boolean;
  is_help_wanted?: boolean;
  post_id?: number;
  budget?: string;
  contact_preference?: string;
  created_by?: string;
  created_date?: string;
  highlights?: {
    title?: string[];
    description?: string[];
    content?: string[];
  };
}

interface SearchResultsProps {
  results: SearchResult[];
}

const CategoryBadge = ({ category }: { category: string }) => {
  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      "Government & Municipal":
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "Healthcare & Emergency":
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      "Education & Universities":
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      Transportation:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      "Community & Culture":
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      "News & Media":
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
      "Business & Finance":
        "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
      "Business Directory":
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "Help Wanted - Hiring":
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "Help Wanted - Collaboration":
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      "Help Wanted - General":
        "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    };
    return (
      colors[cat] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
    );
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(category)}`}
    >
      {category}
    </span>
  );
};

const HighlightedText = ({
  text,
  highlights,
}: {
  text: string;
  highlights?: string[];
}) => {
  if (!highlights || highlights.length === 0) {
    return <span>{text}</span>;
  }

  // Use the first highlight if available, otherwise fall back to original text
  const highlightedText = highlights[0] || text;

  return (
    <span
      dangerouslySetInnerHTML={{
        __html: highlightedText,
      }}
    />
  );
};

export default function SearchResults({ results }: SearchResultsProps) {
  return (
    <div className="space-y-6">
      {results.map((result) => (
        <div
          key={result.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer group"
          onClick={(e) => {
            // Only trigger if we didn't click on a link or button
            if (!(e.target as HTMLElement).closest("a, button")) {
              window.open(result.page_url, "_blank", "noopener,noreferrer");
            }
          }}
        >
          <div className="p-6">
            {/* Header with title and category */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <HighlightedText
                    text={result.title}
                    highlights={result.highlights?.title}
                  />
                </h3>
                <CategoryBadge category={result.category} />
              </div>
              <div className="ml-4 text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Score: {result.score.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Content Excerpt - Main content area */}
            {result.content_excerpt && (
              <div className="mb-4">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {result.content_excerpt}
                </p>
              </div>
            )}

            {/* Meta description only if no content excerpt */}
            {!result.content_excerpt && result.description && (
              <p className="text-gray-600 dark:text-gray-300 mb-3 italic">
                <HighlightedText
                  text={result.description}
                  highlights={result.highlights?.description}
                />
              </p>
            )}

            {/* Content highlights - show more relevant excerpts */}
            {result.highlights?.content &&
              result.highlights.content.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Relevant matches:
                  </div>
                  <div className="space-y-2">
                    {result.highlights.content
                      .slice(0, 3)
                      .map((highlight, index) => (
                        <div
                          key={index}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border-l-2 border-yellow-400"
                          dangerouslySetInnerHTML={{
                            __html: `...${highlight}...`,
                          }}
                        />
                      ))}
                  </div>
                </div>
              )}

            {/* Contact Information and Links */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {result.is_help_wanted ? (
                <>
                  {/* Help Wanted Post Link */}
                  <a
                    href={`/help-wanted/${result.post_id}`}
                    className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:underline"
                  >
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
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    View Help Wanted Post
                  </a>

                  {/* Budget */}
                  {result.budget && (
                    <span className="inline-flex items-center text-green-600 dark:text-green-400">
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
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {result.budget}
                    </span>
                  )}

                  {/* Location */}
                  {result.address && (
                    <span className="inline-flex items-center text-gray-600 dark:text-gray-400">
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
                      {result.address}
                    </span>
                  )}

                  {/* Posted by */}
                  {result.created_by && (
                    <span className="inline-flex items-center text-gray-600 dark:text-gray-400">
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
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      {result.created_by}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {/* Main Website Link */}
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline"
                  >
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
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    {result.domain}
                  </a>

                  {/* Specific Page Link (only show if different from main URL) */}
                  {result.page_url && result.page_url !== result.url && (
                    <a
                      href={result.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:underline"
                    >
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Found on this page
                    </a>
                  )}

                  {/* Phone */}
                  {result.phone && (
                    <a
                      href={`tel:${result.phone}`}
                      className="inline-flex items-center text-green-600 dark:text-green-400 hover:underline"
                    >
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
                      {result.phone}
                    </a>
                  )}

                  {/* Address */}
                  {result.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:underline"
                    >
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
                      {result.address}
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
