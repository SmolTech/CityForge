"use client";

import { useState, useEffect } from "react";
import { apiClient, Card, Tag, User } from "@/lib/api";
import CardComponent from "@/components/Card";
import SearchBar from "@/components/SearchBar";
import TagCloud from "@/components/TagCloud";
import FilterPanel from "@/components/FilterPanel";
import Navigation from "@/components/Navigation";
import Pagination from "@/components/Pagination";
import { useConfig } from "@/contexts/ConfigContext";

export default function Home() {
  const config = useConfig();
  const siteConfig = config.site;
  const itemsPerPage = config.pagination.defaultLimit;
  const [cards, setCards] = useState<Card[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<"and" | "or">("and");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadData();
    checkAuth();
  }, [searchTerm, selectedTags, tagFilterMode, showFeaturedOnly, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTags, tagFilterMode, showFeaturedOnly]);

  const checkAuth = async () => {
    if (apiClient.isAuthenticated()) {
      try {
        const userResponse = await apiClient.getCurrentUser();
        setUser(userResponse.user);
      } catch (error) {
        console.error("Failed to get user:", error);
      }
    }
  };

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const offset = (currentPage - 1) * itemsPerPage;
      const [cardsResponse, tagsResponse] = await Promise.all([
        apiClient.getCards({
          search: searchTerm || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          tagMode: tagFilterMode,
          featured: showFeaturedOnly || undefined,
          includeShareUrls: true,
          includeRatings: true,
          limit: itemsPerPage,
          offset: offset,
        }),
        apiClient.getTags(),
      ]);
      setCards(cardsResponse.cards);
      setTotalItems(cardsResponse.total);
      setTags(tagsResponse);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setError(
        `Failed to load directory: ${errorMessage}. Please check that the backend API is running and accessible.`
      );
      setCards([]);
      setTags([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }

  const handleTagClick = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleTagRemove = (tagName: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tagName));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of page when changing pages
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
      <Navigation currentPage="Directory" siteTitle={siteConfig.title} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {siteConfig && (
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent mb-4">
              {siteConfig.tagline}
            </h2>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
              {siteConfig.directoryDescription}
            </p>
            <div className="mt-6 text-center">
              {user ? (
                <a
                  href="/submit"
                  className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  Submit New Entry
                </a>
              ) : (
                <div className="space-y-3">
                  <a
                    href="/register"
                    className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  >
                    Sign Up to Submit
                  </a>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Already have an account?{" "}
                    <a
                      href="/login"
                      className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      Login
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search cards..."
            />

            <FilterPanel
              showFeaturedOnly={showFeaturedOnly}
              onFeaturedChange={setShowFeaturedOnly}
              selectedTags={selectedTags}
              onTagRemove={handleTagRemove}
              tagFilterMode={tagFilterMode}
              onTagFilterModeChange={setTagFilterMode}
            />

            <TagCloud
              tags={tags}
              selectedTags={selectedTags}
              onTagClick={handleTagClick}
            />
          </div>

          <div className="lg:col-span-3">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-red-600 dark:text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Error Loading Directory
                    </h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      <p>{error}</p>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => loadData()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No cards found matching your criteria.
                </p>
                {(searchTerm ||
                  selectedTags.length > 0 ||
                  showFeaturedOnly) && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedTags([]);
                      setShowFeaturedOnly(false);
                    }}
                    className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {cards.map((card) => (
                    <CardComponent key={card.id} card={card} />
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 mt-16">
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
