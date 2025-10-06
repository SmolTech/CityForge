"use client";

import { useState, useEffect } from "react";
import { apiClient, Card, Tag, User } from "@/lib/api";
import CardComponent from "@/components/Card";
import SearchBar from "@/components/SearchBar";
import TagCloud from "@/components/TagCloud";
import FilterPanel from "@/components/FilterPanel";
import Navigation from "@/components/Navigation";
import { CLIENT_CONFIG } from "@/lib/client-config";

export default function Home() {
  const [cards, setCards] = useState<Card[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [siteConfig, setSiteConfig] = useState<{
    title: string;
    tagline: string;
    directoryDescription: string;
    copyright: string;
    copyrightHolder: string;
    copyrightUrl: string;
  } | null>(null);

  useEffect(() => {
    loadData();
    checkAuth();
    loadSiteConfig();
  }, [searchTerm, selectedTags, showFeaturedOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSiteConfig = async () => {
    try {
      const response = await fetch("/api/config");
      if (response.ok) {
        const config = await response.json();
        setSiteConfig(config.site);
      } else {
        // Set fallback config on failure
        setSiteConfig({
          title: CLIENT_CONFIG.SITE_TITLE,
          tagline: "Community Directory",
          directoryDescription:
            "Discover local businesses, events, news, and community resources. Search by name, description, or use tags to find exactly what you're looking for.",
          copyright: "2025",
          copyrightHolder: "SmolTech",
          copyrightUrl: "https://www.smoltech.us",
        });
      }
    } catch (error) {
      console.error("Failed to load site config:", error);
      // Set fallback config on error
      setSiteConfig({
        title: CLIENT_CONFIG.SITE_TITLE,
        tagline: "Community Directory",
        directoryDescription:
          "Discover local businesses, events, news, and community resources. Search by name, description, or use tags to find exactly what you're looking for.",
        copyright: "2025",
        copyrightHolder: "SmolTech",
        copyrightUrl: "https://www.smoltech.us",
      });
    }
  };

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
      const [cardsResponse, tagsResponse] = await Promise.all([
        apiClient.getCards({
          search: searchTerm || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          featured: showFeaturedOnly || undefined,
          includeShareUrls: true,
        }),
        apiClient.getTags(),
      ]);
      setCards(cardsResponse.cards);
      setTags(tagsResponse);
    } catch (error) {
      console.error("Failed to fetch data:", error);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
      <Navigation currentPage="Directory" siteTitle={siteConfig?.title || ""} />

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
            ) : cards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No cards found matching your criteria.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {cards.map((card) => (
                  <CardComponent key={card.id} card={card} />
                ))}
              </div>
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
