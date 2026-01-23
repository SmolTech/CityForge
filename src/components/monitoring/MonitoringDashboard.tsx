/**
 * Production Monitoring Dashboard
 *
 * Provides real-time monitoring data for CityForge application
 * Displays metrics, health status, and system information
 */

"use client";

import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";

interface HealthData {
  status: string;
  timestamp: string;
  services: {
    database: string;
    server: string;
  };
  metrics?: {
    uptime: number;
    requestCount: number;
    errorRate: number;
    memoryUsage: number;
    avgResponseTime: number;
  };
}

interface MetricsData {
  status: string;
  timestamp: string;
  metrics: {
    httpRequestTotal: number;
    httpRequestDuration: number[];
    httpErrorRate: number;
    userRegistrations: number;
    businessSubmissions: number;
    searchQueries: number;
    sitemapGenerations: number;
    memoryUsage: number;
    uptime: number;
    eventsCount: number;
  };
  recentEvents: Array<{
    timestamp: number;
    type: string;
    name: string;
    value: number;
    labels?: Record<string, string>;
  }>;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatMemory(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb > 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function MonitoringDashboard() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      const response = await fetch("/api/health");
      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      logger.error("Failed to fetch health data:", err);
      setError("Failed to fetch health data");
    }
  };

  const fetchMetricsData = async () => {
    try {
      const response = await fetch("/api/metrics");
      const data = await response.json();
      setMetricsData(data);
    } catch (err) {
      logger.error("Failed to fetch metrics data:", err);
      setError("Failed to fetch metrics data");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchHealthData(), fetchMetricsData()]);
      setLoading(false);
    };

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading monitoring data...</div>
      </div>
    );
  }

  if (error || !healthData || !metricsData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-800 mb-2">
          Monitoring Unavailable
        </h2>
        <p className="text-red-600">
          {error || "Unable to load monitoring data"}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const isHealthy = healthData.status === "ok";
  const metrics = metricsData.metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Production Monitoring
        </h1>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isHealthy
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {isHealthy ? "Healthy" : "Unhealthy"}
        </div>
      </div>

      {/* System Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Uptime
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatUptime(metrics.uptime / 1000)}
          </p>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Total Requests
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {metrics.httpRequestTotal.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Error Rate
          </h3>
          <p
            className={`text-2xl font-bold mt-2 ${
              metrics.httpErrorRate > 0.05 ? "text-red-600" : "text-green-600"
            }`}
          >
            {(metrics.httpErrorRate * 100).toFixed(2)}%
          </p>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Memory Usage
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatMemory(metrics.memoryUsage)}
          </p>
        </div>
      </div>

      {/* Business Metrics */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Business Metrics
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
          <div>
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              User Registrations
            </h4>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {metrics.userRegistrations.toLocaleString()}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Business Submissions
            </h4>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {metrics.businessSubmissions.toLocaleString()}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Search Queries
            </h4>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {metrics.searchQueries.toLocaleString()}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Sitemap Generations
            </h4>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {metrics.sitemapGenerations.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Activity
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {metricsData.recentEvents.length > 0 ? (
            <div className="divide-y">
              {metricsData.recentEvents.map((event, index) => (
                <div key={index} className="px-6 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {event.name}
                      </span>
                      <span
                        className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          event.type === "counter"
                            ? "bg-blue-100 text-blue-800"
                            : event.type === "gauge"
                              ? "bg-green-100 text-green-800"
                              : event.type === "timer"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {event.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {event.type === "timer"
                          ? `${event.value.toFixed(0)}ms`
                          : event.value}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  {event.labels && Object.keys(event.labels).length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      {Object.entries(event.labels).map(([key, value]) => (
                        <span key={key} className="mr-3">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent activity
            </div>
          )}
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(metricsData.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
