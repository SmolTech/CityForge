"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import Navigation from "@/components/Navigation";

interface ResourceConfig {
  id: number;
  key: string;
  value: string;
  description?: string;
  created_date: string;
  updated_date: string;
}

interface QuickAccessItem {
  id: string;
  title: string;
  subtitle: string;
  phone: string;
  color: string;
  icon: string;
}

interface ResourceItem {
  id: number;
  title: string;
  url: string;
  description: string;
  category: string;
  phone?: string;
  address?: string;
  icon: string;
}

export default function AdminResourcesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "config" | "quick-access" | "items"
  >("config");
  const [loading, setLoading] = useState(true);

  // Config state
  const [configs, setConfigs] = useState<ResourceConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<ResourceConfig | null>(
    null
  );

  // Quick Access state
  const [quickAccessItems, setQuickAccessItems] = useState<QuickAccessItem[]>(
    []
  );
  const [editingQuickAccess, setEditingQuickAccess] =
    useState<QuickAccessItem | null>(null);
  const [showAddQuickAccess, setShowAddQuickAccess] = useState(false);

  // Resource Items state
  const [resourceItems, setResourceItems] = useState<ResourceItem[]>([]);
  const [editingResourceItem, setEditingResourceItem] =
    useState<ResourceItem | null>(null);
  const [showAddResourceItem, setShowAddResourceItem] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (activeTab === "config") {
      loadConfigs();
    } else if (activeTab === "quick-access") {
      loadQuickAccessItems();
    } else if (activeTab === "items") {
      loadResourceItems();
    }
  }, [activeTab]);

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

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await apiClient.adminGetResourceConfigs();
      setConfigs(data);
    } catch (error) {
      setError("Failed to load configurations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuickAccessItems = async () => {
    try {
      setLoading(true);
      const data = await apiClient.adminGetQuickAccessItems();
      setQuickAccessItems(data);
    } catch (error) {
      setError("Failed to load quick access items");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadResourceItems = async () => {
    try {
      setLoading(true);
      const data = await apiClient.adminGetResourceItems();
      setResourceItems(data);
    } catch (err) {
      setError("Failed to load resource items");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (id: number, value: string) => {
    try {
      await apiClient.adminUpdateResourceConfig(id, { value });
      setEditingConfig(null);
      loadConfigs();
    } catch (error) {
      setError("Failed to update configuration");
      console.error(error);
    }
  };

  const handleCreateQuickAccess = async (
    data: Partial<QuickAccessItem> & {
      identifier: string;
      display_order?: number;
      is_active?: boolean;
    }
  ) => {
    try {
      await apiClient.adminCreateQuickAccessItem(data);
      setShowAddQuickAccess(false);
      loadQuickAccessItems();
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create quick access item"
      );
      console.error(error);
    }
  };

  const handleUpdateQuickAccess = async (
    id: number,
    data: Partial<QuickAccessItem> & {
      identifier?: string;
      display_order?: number;
      is_active?: boolean;
    }
  ) => {
    try {
      await apiClient.adminUpdateQuickAccessItem(id, data);
      setEditingQuickAccess(null);
      loadQuickAccessItems();
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update quick access item"
      );
      console.error(error);
    }
  };

  const handleDeleteQuickAccess = async (id: number) => {
    if (!confirm("Are you sure you want to delete this quick access item?"))
      return;
    try {
      await apiClient.adminDeleteQuickAccessItem(id);
      loadQuickAccessItems();
    } catch (error) {
      setError("Failed to delete quick access item");
      console.error(error);
    }
  };

  const handleCreateResourceItem = async (
    data: Omit<ResourceItem, "id"> & {
      display_order?: number;
      is_active?: boolean;
    }
  ) => {
    try {
      await apiClient.adminCreateResourceItem(data);
      setShowAddResourceItem(false);
      loadResourceItems();
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create resource item"
      );
      console.error(error);
    }
  };

  const handleUpdateResourceItem = async (
    id: number,
    data: Partial<ResourceItem> & {
      display_order?: number;
      is_active?: boolean;
    }
  ) => {
    try {
      await apiClient.adminUpdateResourceItem(id, data);
      setEditingResourceItem(null);
      loadResourceItems();
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update resource item"
      );
      console.error(error);
    }
  };

  const handleDeleteResourceItem = async (id: number) => {
    if (!confirm("Are you sure you want to delete this resource item?")) return;
    try {
      await apiClient.adminDeleteResourceItem(id);
      loadResourceItems();
    } catch (error) {
      setError("Failed to delete resource item");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Admin - Resources" siteTitle="Admin" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Resources Management
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab("config")}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === "config"
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Configuration
              </button>
              <button
                onClick={() => setActiveTab("quick-access")}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === "quick-access"
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Quick Access
              </button>
              <button
                onClick={() => setActiveTab("items")}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === "items"
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Resource Items
              </button>
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <>
                {activeTab === "config" && (
                  <div className="space-y-4">
                    {configs.map((config) => (
                      <div
                        key={config.id}
                        className="border border-gray-200 dark:border-gray-700 rounded p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {config.key}
                            </h3>
                            {editingConfig?.id === config.id ? (
                              <div className="mt-2">
                                <textarea
                                  defaultValue={config.value}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  rows={3}
                                  id={`config-${config.id}`}
                                />
                                <div className="mt-2 space-x-2">
                                  <button
                                    onClick={() => {
                                      const textarea = document.getElementById(
                                        `config-${config.id}`
                                      ) as HTMLTextAreaElement;
                                      handleUpdateConfig(
                                        config.id,
                                        textarea.value
                                      );
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingConfig(null)}
                                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {config.value}
                              </p>
                            )}
                            {config.description && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                {config.description}
                              </p>
                            )}
                          </div>
                          {!editingConfig && (
                            <button
                              onClick={() => setEditingConfig(config)}
                              className="ml-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "quick-access" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Quick Access Items
                      </h2>
                      <button
                        onClick={() => setShowAddQuickAccess(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Add Quick Access
                      </button>
                    </div>

                    {showAddQuickAccess && (
                      <QuickAccessForm
                        onSubmit={handleCreateQuickAccess}
                        onCancel={() => setShowAddQuickAccess(false)}
                      />
                    )}

                    {quickAccessItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 dark:border-gray-700 rounded p-4"
                      >
                        {editingQuickAccess?.id === item.id ? (
                          <QuickAccessForm
                            item={item}
                            onSubmit={(data) =>
                              handleUpdateQuickAccess(index + 1, data)
                            }
                            onCancel={() => setEditingQuickAccess(null)}
                          />
                        ) : (
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {item.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {item.subtitle}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Phone: {item.phone}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                Color: {item.color} | Icon: {item.icon}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingQuickAccess(item)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteQuickAccess(index + 1)
                                }
                                className="text-red-600 hover:text-red-800 dark:text-red-400"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "items" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Resource Items
                      </h2>
                      <button
                        onClick={() => setShowAddResourceItem(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Add Resource Item
                      </button>
                    </div>

                    {showAddResourceItem && (
                      <ResourceItemForm
                        onSubmit={handleCreateResourceItem}
                        onCancel={() => setShowAddResourceItem(false)}
                      />
                    )}

                    {resourceItems.map((item) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 dark:border-gray-700 rounded p-4"
                      >
                        {editingResourceItem?.id === item.id ? (
                          <ResourceItemForm
                            item={item}
                            onSubmit={(data) =>
                              handleUpdateResourceItem(item.id, data)
                            }
                            onCancel={() => setEditingResourceItem(null)}
                          />
                        ) : (
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {item.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {item.description}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Category: {item.category}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                URL:{" "}
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {item.url}
                                </a>
                              </p>
                              {item.phone && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Phone: {item.phone}
                                </p>
                              )}
                              {item.address && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Address: {item.address}
                                </p>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingResourceItem(item)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteResourceItem(item.id)
                                }
                                className="text-red-600 hover:text-red-800 dark:text-red-400"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAccessForm({
  item,
  onSubmit,
  onCancel,
}: {
  item?: QuickAccessItem | null;
  onSubmit: (
    data: Partial<QuickAccessItem> & {
      identifier: string;
      display_order?: number;
      is_active?: boolean;
    }
  ) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(
    item || {
      identifier: "",
      title: "",
      subtitle: "",
      phone: "",
      color: "blue",
      icon: "building",
      display_order: 0,
      is_active: true,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 dark:border-gray-700 rounded p-4 space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Identifier
        </label>
        <input
          type="text"
          value={formData.identifier}
          onChange={(e) =>
            setFormData({ ...formData, identifier: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Subtitle
        </label>
        <input
          type="text"
          value={formData.subtitle}
          onChange={(e) =>
            setFormData({ ...formData, subtitle: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Phone
        </label>
        <input
          type="text"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Color
          </label>
          <select
            value={formData.color}
            onChange={(e) =>
              setFormData({ ...formData, color: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="purple">Purple</option>
            <option value="red">Red</option>
            <option value="orange">Orange</option>
            <option value="yellow">Yellow</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon
          </label>
          <input
            type="text"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {item ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ResourceItemForm({
  item,
  onSubmit,
  onCancel,
}: {
  item?: ResourceItem | null;
  onSubmit: (
    data: Partial<ResourceItem> & {
      display_order?: number;
      is_active?: boolean;
    }
  ) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(
    item || {
      title: "",
      url: "",
      description: "",
      category: "",
      phone: "",
      address: "",
      icon: "building",
      display_order: 0,
      is_active: true,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 dark:border-gray-700 rounded p-4 space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          URL
        </label>
        <input
          type="url"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          rows={3}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Category
        </label>
        <input
          type="text"
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone (optional)
          </label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon
          </label>
          <input
            type="text"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Address (optional)
        </label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {item ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
