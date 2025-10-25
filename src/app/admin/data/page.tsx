"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, User } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

interface ModelInfo {
  name: string;
  count: number;
}

interface ImportStats {
  [key: string]: {
    added: number;
  };
}

export default function DataManagementPage() {
  const [, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [confirmClean, setConfirmClean] = useState("");
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        router.push("/login");
        return;
      }

      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.user.role !== "admin") {
        router.push("/");
        return;
      }
      setUser(userResponse.user);

      // Load available models
      const apiBaseUrl = process.env["NEXT_PUBLIC_API_URL"] || "";
      const response = await fetch(`${apiBaseUrl}/api/admin/data/models`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load models");
      }

      const data = await response.json();
      setModels(data.models);
    } catch (error) {
      logger.error("Failed to load data:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError("");
    setSuccess("");

    try {
      const requestBody = selectAll ? {} : { include: selectedModels };
      const apiBaseUrl = process.env["NEXT_PUBLIC_API_URL"] || "";

      const response = await fetch(`${apiBaseUrl}/api/admin/data/export`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers.get("content-disposition")?.split("filename=")[1] ||
        `export_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess("Export downloaded successfully!");
    } catch (err) {
      logger.error("Export failed:", err);
      setError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setError("Please select a file to import");
      return;
    }

    if (confirmClean !== "DELETE ALL DATA") {
      setError('Please type "DELETE ALL DATA" to confirm');
      return;
    }

    setImporting(true);
    setError("");
    setSuccess("");
    setImportStats(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("confirm", confirmClean);
      if (!selectAll && selectedModels.length > 0) {
        formData.append("include", selectedModels.join(","));
      }

      const apiBaseUrl = process.env["NEXT_PUBLIC_API_URL"] || "";
      const response = await fetch(`${apiBaseUrl}/api/admin/data/import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setSuccess(data.message || "Import completed successfully!");
      setImportStats(data.stats);
      setImportFile(null);
      setConfirmClean("");

      // Reload models to update counts
      await loadData();
    } catch (err: unknown) {
      logger.error("Import failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Import failed. Please try again.";
      setError(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const toggleModel = (modelName: string) => {
    if (selectedModels.includes(modelName)) {
      setSelectedModels(selectedModels.filter((m) => m !== modelName));
    } else {
      setSelectedModels([...selectedModels, modelName]);
    }
  };

  const handleSelectAllChange = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedModels([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Admin" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <nav className="text-sm mb-4">
            <Link href="/admin" className="text-blue-600 hover:text-blue-800">
              Admin
            </Link>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-700 dark:text-gray-300">
              Data Management
            </span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Data Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Export and import database data for backups, migrations, and
            restoration
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-200 px-4 py-3 rounded">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Export Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Export Data
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Export database data to JSON format for backup or migration
            </p>

            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAllChange(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>Export all models</span>
                </label>
              </div>

              {!selectAll && (
                <div className="border dark:border-gray-700 rounded p-4 max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Select models to export:
                  </p>
                  <div className="space-y-2">
                    {models.map((model) => (
                      <label
                        key={model.name}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model.name)}
                          onChange={() => toggleModel(model.name)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {model.name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          ({model.count} records)
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={
                  exporting || (!selectAll && selectedModels.length === 0)
                }
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? "Exporting..." : "Export Data"}
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Import Data
            </h2>
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                ⚠️ WARNING: This will DELETE ALL EXISTING DATA and replace it
                with the imported data.
              </p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                Only use this for restoring backups to the same database.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Import File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                  Type &quot;DELETE ALL DATA&quot; to confirm
                </label>
                <input
                  type="text"
                  value={confirmClean}
                  onChange={(e) => setConfirmClean(e.target.value)}
                  className="block w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="DELETE ALL DATA"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAllChange(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>Import all models</span>
                </label>
              </div>

              {!selectAll && (
                <div className="border dark:border-gray-700 rounded p-4 max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Select models to import:
                  </p>
                  <div className="space-y-2">
                    {models.map((model) => (
                      <label
                        key={model.name}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model.name)}
                          onChange={() => toggleModel(model.name)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {model.name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          ({model.count} records)
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={
                  importing || !importFile || confirmClean !== "DELETE ALL DATA"
                }
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {importing
                  ? "Deleting & Importing..."
                  : "Delete All Data & Import"}
              </button>
            </div>
          </div>
        </div>

        {/* Import Stats */}
        {importStats && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Import Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(importStats).map(([model, stats]) => (
                <div
                  key={model}
                  className="border dark:border-gray-700 rounded p-4"
                >
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                    {model}
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Imported: {stats.added} records
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Database Stats */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Current Database Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {models.map((model) => (
              <div
                key={model.name}
                className="border dark:border-gray-700 rounded p-3"
              >
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {model.name}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {model.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
