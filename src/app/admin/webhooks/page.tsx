"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";
import { WebhookEventType } from "@/lib/webhooks/types";

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  enabled: boolean;
  events: WebhookEventType[];
  headers?: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    retryDelaySeconds: number;
    exponentialBackoff: boolean;
  };
  timeoutSeconds: number;
  created_at: string;
  updated_at: string;
}

const WEBHOOK_EVENTS = [
  { value: "submission.created", label: "Business Submissions" },
  { value: "modification.created", label: "Business Modifications" },
  { value: "forum.report.created", label: "Forum Reports" },
  { value: "forum.category_request.created", label: "Category Requests" },
  { value: "auth.email_verification.requested", label: "Email Verification" },
  { value: "auth.password_reset.requested", label: "Password Reset" },
  { value: "admin.notification", label: "Admin Notifications" },
] as const;

export default function AdminWebhooksPage() {
  const [loading, setLoading] = useState(true);
  const [webhooksEnabled, setWebhooksEnabled] = useState(false);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(
    null
  );
  const [deletingWebhook, setDeletingWebhook] =
    useState<WebhookEndpoint | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    secret: "",
    enabled: true,
    events: [] as WebhookEventType[],
    headers: "",
    timeoutSeconds: 30,
    maxRetries: 3,
    retryDelaySeconds: 5,
    exponentialBackoff: true,
  });

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        router.push("/login");
        return false;
      }

      const { user } = await response.json();
      if (user.role !== "admin") {
        router.push("/");
        return false;
      }

      return true;
    } catch {
      router.push("/login");
      return false;
    }
  }, [router]);

  const loadWebhooks = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/webhooks");
      if (!response.ok) throw new Error("Failed to fetch");

      const { endpoints } = await response.json();
      setWebhooks(endpoints);
    } catch (error) {
      logger.error("Failed to load webhooks:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // First check authentication
      const isAuth = await checkAuth();
      if (!isAuth) {
        setLoading(false);
        return;
      }

      // Check if webhooks are enabled
      try {
        const configResponse = await fetch("/api/admin/config", {
          credentials: "include",
        });

        if (configResponse.ok) {
          const config = await configResponse.json();
          setWebhooksEnabled(config.webhooksEnabled);

          if (!config.webhooksEnabled) {
            // Webhooks are disabled, redirect to admin dashboard
            router.push("/admin");
            return;
          }

          // Webhooks are enabled, load them
          await loadWebhooks();
        } else {
          // Failed to get config, assume webhooks are disabled
          router.push("/admin");
          return;
        }
      } catch (error) {
        logger.error("Failed to check webhook configuration:", error);
        router.push("/admin");
        return;
      }

      setLoading(false);
    };

    init();
  }, [checkAuth, loadWebhooks, router]);

  const resetForm = () => {
    setFormData({
      name: "",
      url: "",
      secret: "",
      enabled: true,
      events: [],
      headers: "",
      timeoutSeconds: 30,
      maxRetries: 3,
      retryDelaySeconds: 5,
      exponentialBackoff: true,
    });
  };

  const handleCreateWebhook = async () => {
    try {
      let headers = {};
      if (formData.headers) {
        try {
          headers = JSON.parse(formData.headers);
        } catch {
          alert("Invalid JSON format for headers");
          return;
        }
      }

      const payload = {
        name: formData.name,
        url: formData.url,
        secret: formData.secret || undefined,
        enabled: formData.enabled,
        events: formData.events,
        headers,
        timeoutSeconds: formData.timeoutSeconds,
        retryPolicy: {
          maxRetries: formData.maxRetries,
          retryDelaySeconds: formData.retryDelaySeconds,
          exponentialBackoff: formData.exponentialBackoff,
        },
      };

      const response = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create webhook");
      }

      setShowCreateForm(false);
      resetForm();
      await loadWebhooks();
    } catch (error) {
      logger.error("Failed to create webhook:", error);
      alert(
        error instanceof Error ? error.message : "Failed to create webhook"
      );
    }
  };

  const handleUpdateWebhook = async () => {
    if (!editingWebhook) return;

    try {
      let headers = {};
      if (formData.headers) {
        try {
          headers = JSON.parse(formData.headers);
        } catch {
          alert("Invalid JSON format for headers");
          return;
        }
      }

      const payload = {
        name: formData.name,
        url: formData.url,
        secret: formData.secret || undefined,
        enabled: formData.enabled,
        events: formData.events,
        headers,
        timeoutSeconds: formData.timeoutSeconds,
        retryPolicy: {
          maxRetries: formData.maxRetries,
          retryDelaySeconds: formData.retryDelaySeconds,
          exponentialBackoff: formData.exponentialBackoff,
        },
      };

      const response = await fetch(`/api/admin/webhooks/${editingWebhook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to update webhook");
      }

      setEditingWebhook(null);
      resetForm();
      await loadWebhooks();
    } catch (error) {
      logger.error("Failed to update webhook:", error);
      alert(
        error instanceof Error ? error.message : "Failed to update webhook"
      );
    }
  };

  const handleDeleteWebhook = async () => {
    if (!deletingWebhook) return;

    try {
      const response = await fetch(
        `/api/admin/webhooks/${deletingWebhook.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to delete webhook");
      }

      setDeletingWebhook(null);
      await loadWebhooks();
    } catch (error) {
      logger.error("Failed to delete webhook:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete webhook"
      );
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhook(webhookId);
    try {
      const response = await fetch("/api/admin/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "submission.created",
          endpointId: webhookId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to test webhook");
      }

      alert("Test webhook sent successfully!");
    } catch (error) {
      logger.error("Failed to test webhook:", error);
      alert(error instanceof Error ? error.message : "Failed to test webhook");
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleEditWebhook = (webhook: WebhookEndpoint) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: "",
      enabled: webhook.enabled,
      events: webhook.events,
      headers: webhook.headers ? JSON.stringify(webhook.headers, null, 2) : "",
      timeoutSeconds: webhook.timeoutSeconds,
      maxRetries: webhook.retryPolicy.maxRetries,
      retryDelaySeconds: webhook.retryPolicy.retryDelaySeconds,
      exponentialBackoff: webhook.retryPolicy.exponentialBackoff,
    });
  };

  const handleEventToggle = (eventType: WebhookEventType) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(eventType)
        ? prev.events.filter((e) => e !== eventType)
        : [...prev.events, eventType],
    }));
  };

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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Webhook Management
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Configure webhook endpoints for external integrations
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Create Webhook
          </button>
        </div>

        {/* Webhooks List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Webhook Endpoints ({webhooks.length})
            </h2>
          </div>

          {webhooks.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No webhook endpoints configured.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {webhook.name}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            webhook.enabled
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {webhook.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        URL: {webhook.url}
                      </p>

                      <div className="flex flex-wrap gap-1 mb-2">
                        {webhook.events.map((event) => (
                          <span
                            key={event}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded"
                          >
                            {WEBHOOK_EVENTS.find((e) => e.value === event)
                              ?.label || event}
                          </span>
                        ))}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Timeout: {webhook.timeoutSeconds}s | Max Retries:{" "}
                        {webhook.retryPolicy.maxRetries} |{" "}
                        {webhook.retryPolicy.exponentialBackoff
                          ? "Exponential"
                          : "Linear"}{" "}
                        backoff
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleTestWebhook(webhook.id)}
                        disabled={testingWebhook === webhook.id}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 rounded disabled:opacity-50"
                      >
                        {testingWebhook === webhook.id ? "Testing..." : "Test"}
                      </button>
                      <button
                        onClick={() => handleEditWebhook(webhook)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingWebhook(webhook)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Form Modal */}
        {(showCreateForm || editingWebhook) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {editingWebhook ? "Edit Webhook" : "Create Webhook"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="Slack Notifications"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Secret (optional)
                  </label>
                  <input
                    type="password"
                    value={formData.secret}
                    onChange={(e) =>
                      setFormData({ ...formData, secret: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="webhook_secret_key"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used for HMAC signature verification
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Events *
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {WEBHOOK_EVENTS.map((event) => (
                      <label key={event.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event.value)}
                          onChange={() => handleEventToggle(event.value)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {event.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) =>
                      setFormData({ ...formData, enabled: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <label
                    htmlFor="enabled"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Enabled
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Timeout (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={formData.timeoutSeconds}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          timeoutSeconds: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Retries
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.maxRetries}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxRetries: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Custom Headers (JSON)
                  </label>
                  <textarea
                    value={formData.headers}
                    onChange={(e) =>
                      setFormData({ ...formData, headers: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    rows={3}
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={
                    editingWebhook ? handleUpdateWebhook : handleCreateWebhook
                  }
                  disabled={
                    !formData.name ||
                    !formData.url ||
                    formData.events.length === 0
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingWebhook ? "Update" : "Create"} Webhook
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingWebhook(null);
                    resetForm();
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingWebhook && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Delete Webhook
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete &ldquo;{deletingWebhook.name}
                &rdquo;? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteWebhook}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeletingWebhook(null)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
