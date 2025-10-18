"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AppConfig } from "@/lib/resources";

const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load config once on mount
    async function loadConfig() {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.status}`);
        }
        const data = await response.json();
        setConfig(data);
      } catch (err) {
        console.error("Error loading app config:", err);
        // Set fallback config if fetch fails
        setConfig({
          site: {
            title: "Community Website",
            description:
              "Helping connect people to the resources available to them.",
            tagline: "Community Directory",
            directoryDescription:
              "Discover local resources and community information.",
            copyright: "2025",
            copyrightHolder: "Community",
            copyrightUrl: "#",
            domain: "community.local",
            shortName: "Community",
            fullName: "Community Website",
            themeColor: "#1f2937",
            backgroundColor: "#ffffff",
          },
          resources: {
            title: "Local Resources",
            description: "Essential links to local services and information",
          },
          quickAccess: [],
          resourceItems: [],
          footer: {
            title: "Get in Touch",
            description:
              "Have questions or want to contribute? We'd love to hear from you.",
            contactEmail: "admin@community.local",
            buttonText: "Contact Us",
          },
          pagination: {
            defaultLimit: 20,
          },
        });
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, []);

  // Don't render children until config is loaded
  if (loading) {
    return null; // or return a loading spinner component
  }

  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}

export function useConfig(): AppConfig {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return context;
}
