import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],

  // Configure timeout settings for API routes and server-side requests
  experimental: {
    // Maximum timeout for API routes (in milliseconds)
    // Note: This affects Vercel deployment limits:
    // - Hobby: 10s, Pro: 60s, Enterprise: 900s
    serverComponentsHmrCache: false, // Disable to prevent memory issues in dev
  },

  // Server runtime configuration
  serverRuntimeConfig: {
    // API timeout configuration (used by our middleware)
    apiTimeout: {
      auth: 10000, // 10 seconds
      upload: 60000, // 60 seconds
      admin: 45000, // 45 seconds
      search: 30000, // 30 seconds
      default: 30000, // 30 seconds
    },
  },

  // No API proxying needed - all endpoints are now handled by Next.js API routes
  async rewrites() {
    return [
      // All endpoints have been migrated to Next.js
      // No backend proxy needed - all APIs are now handled by Next.js API routes
      // Previously proxied: Cards API, Tags API, Site Config API, Resources API,
      // Submissions API, Search API, Upload API, Forums API, Support tickets API,
      // Help-wanted API, Admin cards, Admin resources, Admin forums
    ];
  },

  // Configure headers for API routes
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "X-Request-Timeout",
            value: "30000", // 30 seconds default
          },
          {
            key: "X-Content-Security-Policy",
            value: "default-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
