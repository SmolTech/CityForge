"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  apiClient,
  QuickAccessItem,
  QuickAccessItemInput,
  ResourceItem,
  ResourceItemInput,
} from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";
import {
  formatPhoneNumber,
  getPhoneValidationError,
} from "@/lib/phone-validation";

export default function AdminResourcesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"quick-access" | "items">(
    "quick-access"
  );
  const [loading, setLoading] = useState(true);

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

  // Delete confirmation state
  const [deletingQuickAccessId, setDeletingQuickAccessId] = useState<
    number | null
  >(null);
  const [deletingResourceItemId, setDeletingResourceItemId] = useState<
    number | null
  >(null);

  const [error, setError] = useState<string | null>(null);

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
    if (activeTab === "quick-access") {
      loadQuickAccessItems();
    } else if (activeTab === "items") {
      loadResourceItems();
    }
  }, [activeTab]);

  const loadQuickAccessItems = async () => {
    try {
      setLoading(true);
      const data = await apiClient.adminGetQuickAccessItems();
      setQuickAccessItems(data);
    } catch (error) {
      setError("Failed to load quick access items");
      logger.error(error);
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
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuickAccess = async (data: QuickAccessItemInput) => {
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
      logger.error(error);
    }
  };

  const handleUpdateQuickAccess = async (
    id: number,
    data: Partial<QuickAccessItemInput>
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
      logger.error(error);
    }
  };

  const handleDeleteQuickAccess = async (id: number) => {
    try {
      await apiClient.adminDeleteQuickAccessItem(id);
      setDeletingQuickAccessId(null);
      loadQuickAccessItems();
    } catch (error) {
      setError("Failed to delete quick access item");
      logger.error(error);
    }
  };

  const handleCreateResourceItem = async (data: ResourceItemInput) => {
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
      logger.error(error);
    }
  };

  const handleUpdateResourceItem = async (
    id: number,
    data: Partial<ResourceItemInput>
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
      logger.error(error);
    }
  };

  const handleDeleteResourceItem = async (id: number) => {
    try {
      await apiClient.adminDeleteResourceItem(id);
      setDeletingResourceItemId(null);
      loadResourceItems();
    } catch (error) {
      setError("Failed to delete resource item");
      logger.error(error);
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
                                  setDeletingQuickAccessId(index + 1)
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
                                  setDeletingResourceItemId(item.id)
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

      {/* Delete Quick Access Confirmation Modal */}
      {deletingQuickAccessId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Quick Access Item
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this quick access item? This
              action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingQuickAccessId(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteQuickAccess(deletingQuickAccessId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Resource Item Confirmation Modal */}
      {deletingResourceItemId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Resource Item
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this resource item? This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingResourceItemId(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteResourceItem(deletingResourceItemId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAccessForm({
  item,
  onSubmit,
  onCancel,
}: {
  item?: QuickAccessItem | null;
  onSubmit: (data: QuickAccessItemInput) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<QuickAccessItemInput>(
    item
      ? {
          identifier: "",
          title: item.title,
          subtitle: item.subtitle,
          phone: item.phone,
          color: item.color,
          icon: item.icon,
        }
      : {
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

  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate and format phone number
    if (formData.phone) {
      const formattedPhone = formatPhoneNumber(formData.phone);
      if (!formattedPhone) {
        setPhoneError(getPhoneValidationError());
        return;
      }
      formData.phone = formattedPhone;
    }

    setPhoneError(null);
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
          onChange={(e) => {
            setFormData({ ...formData, phone: e.target.value });
            setPhoneError(null); // Clear error when user types
          }}
          className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 ${
            phoneError
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
          } dark:bg-gray-700 dark:text-white`}
          placeholder="(508) 555-0123 or +15085550123"
          required
        />
        {phoneError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {phoneError}
          </p>
        )}
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
  onSubmit: (data: ResourceItemInput) => void;
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

  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate and format phone number (optional field)
    if (formData.phone) {
      const formattedPhone = formatPhoneNumber(formData.phone);
      if (!formattedPhone) {
        setPhoneError(getPhoneValidationError());
        return;
      }
      formData.phone = formattedPhone;
    }

    setPhoneError(null);
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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Phone (optional)
        </label>
        <input
          type="text"
          value={formData.phone}
          onChange={(e) => {
            setFormData({ ...formData, phone: e.target.value });
            setPhoneError(null); // Clear error when user types
          }}
          className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 ${
            phoneError
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
          } dark:bg-gray-700 dark:text-white`}
          placeholder="(508) 555-0123 or +15085550123"
        />
        {phoneError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {phoneError}
          </p>
        )}
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
