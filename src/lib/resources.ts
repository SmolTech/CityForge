import React from "react";

export interface SiteConfig {
  title: string;
  description: string;
  tagline: string;
  directoryDescription: string;
  copyright: string;
  copyrightHolder: string;
  copyrightUrl: string;
  domain: string;
  shortName: string;
  fullName: string;
  themeColor: string;
  backgroundColor: string;
}

export interface ResourcesConfig {
  title: string;
  description: string;
}

export interface PaginationConfig {
  defaultLimit: number;
}

export interface AppConfig {
  site: SiteConfig;
  resources: ResourcesConfig;
  quickAccess: QuickAccessItem[];
  resourceItems: ResourceItem[];
  footer: FooterConfig;
  pagination: PaginationConfig;
}

export interface QuickAccessItem {
  id: string;
  title: string;
  subtitle: string;
  phone: string;
  color: string;
  icon: string;
}

export interface ResourceItem {
  id: number;
  title: string;
  url: string;
  description: string;
  category: string;
  phone?: string;
  address?: string;
  icon: string;
}

export interface FooterConfig {
  title: string;
  description: string;
  contactEmail: string;
  buttonText: string;
}

export const iconComponents: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  building: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      })
    ),
  book: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
      })
    ),
  library: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z",
      })
    ),
  heart: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
      })
    ),
  fire: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M17.657 18.657A8 8 0 716.343 7.343S7 9 9 10c0-2 1-4 4-4 1.657 0 3 .895 3 2 0 1.5-2 3-2 3s4 2 4 5c0 .83-.333 1.5-1 2z",
      })
    ),
  academic: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l7-3 7 3z",
      })
    ),
  bus: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v0a2 2 0 01-2-2H8z",
      })
    ),
  train: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      })
    ),
  image: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
      })
    ),
  theater: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0v16l9-5 9 5V4M7 4h10",
      })
    ),
  globe: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9V3m0 18c-2 0-4-1-4-4h8c0 3-2 4-4 4z",
      })
    ),
  newspaper: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15",
      })
    ),
  phone: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
      })
    ),
  business: ({ className = "w-6 h-6" }) =>
    React.createElement(
      "svg",
      {
        className,
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
      },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      })
    ),
};

// Default icon component to use as fallback
const defaultIconComponent = iconComponents["building"];

export function getIconComponent(
  iconName: string
): React.ComponentType<{ className?: string }> {
  return iconComponents[iconName] ?? defaultIconComponent!;
}

export function getColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
    green:
      "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
    purple:
      "from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700",
    red: "from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
    orange:
      "from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
    yellow:
      "from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700",
  };
  return (
    colorMap[color] ??
    "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
  );
}
