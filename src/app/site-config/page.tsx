"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ResourceConfig } from "@/lib/api";
import Navigation from "@/components/Navigation";

export default function SiteConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<ResourceConfig[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const response = await apiClient.getCurrentUser();
      if (response.user.role !== "admin") {
        router.push("/");
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await apiClient.adminGetResourceConfigs();
      setConfigs(data);

      // Initialize form data with current values
      const initialData: Record<string, string> = {};
      data.forEach((config) => {
        initialData[config.key] = config.value;
      });
      setFormData(initialData);
    } catch (error) {
      setError("Failed to load site configuration");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Update all configs
      for (const config of configs) {
        if (formData[config.key] !== config.value) {
          await apiClient.adminUpdateResourceConfig(config.id, {
            value: formData[config.key],
          });
        }
      }

      setSuccessMessage("Configuration saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadConfigs(); // Reload to confirm
    } catch (error) {
      setError("Failed to save configuration");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getFieldLabel = (key: string): string => {
    // Convert key to human-readable label
    const labels: Record<string, string> = {
      site_title: "Site Title",
      site_tagline: "Site Tagline",
      site_description: "Site Description",
      resources_title: "Resources Page Title",
      resources_description: "Resources Page Description",
      resources_footer_title: "Resources Footer Title",
      resources_footer_description: "Resources Footer Description",
      resources_contact_email: "Resources Contact Email",
      resources_button_text: "Resources Button Text",
      directory_tagline: "Directory Tagline",
      directory_description: "Directory Description",
      copyright_year: "Copyright Year",
      copyright_holder: "Copyright Holder",
      copyright_url: "Copyright URL",
      pagination_default_limit: "Items Per Page",
    };
    return (
      labels[key] ||
      key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  const getFieldDescription = (key: string): string | null => {
    const descriptions: Record<string, string> = {
      site_title:
        "The main title of your website (appears in navigation and browser tabs)",
      site_tagline: "A short tagline describing your site",
      site_description: "A brief description of your website",
      resources_title: "Main heading for the Resources page",
      resources_description: "Introduction text for the Resources page",
      resources_footer_title:
        "Title shown in the Resources page footer section",
      resources_footer_description:
        "Description text in the Resources page footer",
      resources_contact_email: "Email address for resource-related inquiries",
      resources_button_text: "Text displayed on contact buttons",
      directory_tagline: "Tagline shown on the Directory (home) page",
      directory_description: "Description text for the business directory",
      copyright_year: "Year to display in copyright notices",
      copyright_holder: "Name of the copyright holder",
      copyright_url: "URL link for the copyright holder",
      pagination_default_limit:
        "Default number of items to display per page in directory listings (recommended: 10-50)",
    };
    return descriptions[key] || null;
  };

  const groupConfigs = () => {
    const groups: Record<string, ResourceConfig[]> = {
      "Site Information": [],
      "Resources Page": [],
      "Directory Page": [],
      "Pagination & Display": [],
      "Copyright & Legal": [],
      Other: [],
    };

    configs.forEach((config) => {
      if (config.key.startsWith("site_")) {
        groups["Site Information"].push(config);
      } else if (config.key.startsWith("resources_")) {
        groups["Resources Page"].push(config);
      } else if (config.key.startsWith("directory_")) {
        groups["Directory Page"].push(config);
      } else if (config.key.startsWith("pagination_")) {
        groups["Pagination & Display"].push(config);
      } else if (config.key.startsWith("copyright_")) {
        groups["Copyright & Legal"].push(config);
      } else {
        groups["Other"].push(config);
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach((key) => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
        <Navigation currentPage="Site Settings" siteTitle="Admin" />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Loading configuration...
            </p>
          </div>
        </main>
      </div>
    );
  }

  const groupedConfigs = groupConfigs();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
      <Navigation currentPage="Site Settings" siteTitle="Admin" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Site Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your website&apos;s global settings and content
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300">
            {successMessage}
          </div>
        )}

        <div className="space-y-8">
          {Object.entries(groupedConfigs).map(([groupName, groupConfigs]) => (
            <div
              key={groupName}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {groupName}
              </h2>
              <div className="space-y-6">
                {groupConfigs.map((config) => (
                  <div key={config.id}>
                    <label
                      htmlFor={`config-${config.id}`}
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      {getFieldLabel(config.key)}
                    </label>
                    {getFieldDescription(config.key) && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {getFieldDescription(config.key)}
                      </p>
                    )}
                    {config.key.includes("description") ||
                    config.value.length > 100 ? (
                      <textarea
                        id={`config-${config.id}`}
                        value={formData[config.key] || ""}
                        onChange={(e) =>
                          handleInputChange(config.key, e.target.value)
                        }
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white transition-all"
                      />
                    ) : config.key === "pagination_default_limit" ? (
                      <input
                        id={`config-${config.id}`}
                        type="number"
                        min="5"
                        max="100"
                        value={formData[config.key] || ""}
                        onChange={(e) =>
                          handleInputChange(config.key, e.target.value)
                        }
                        className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white transition-all"
                      />
                    ) : (
                      <input
                        id={`config-${config.id}`}
                        type="text"
                        value={formData[config.key] || ""}
                        onChange={(e) =>
                          handleInputChange(config.key, e.target.value)
                        }
                        className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={() => router.push("/admin")}
            className="px-6 py-3 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {saving ? "Saving..." : "Save All Changes"}
          </button>
        </div>
      </main>
    </div>
  );
}
