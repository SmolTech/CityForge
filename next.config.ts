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

  // Selective API proxy - only forward non-migrated endpoints to Flask backend
  async rewrites() {
    const backendUrl =
      process.env["BACKEND_API_URL"] || "http://localhost:5000";

    return [
      // Proxy non-migrated endpoints to Flask backend
      // Cards API, Tags API, Site Config API, Resources API, Submissions API, Search API, Upload API, Forums API, Support tickets API, and Help-wanted API have been migrated to Next.js
      // Admin endpoints that haven't been migrated yet
      {
        source: "/api/admin/cards/:path*",
        destination: `${backendUrl}/api/admin/cards/:path*`,
      },
      {
        source: "/api/admin/resources/:path*",
        destination: `${backendUrl}/api/admin/resources/:path*`,
      },
      {
        source: "/api/admin/forums/:path*",
        destination: `${backendUrl}/api/admin/forums/:path*`,
      },
    ];
  },

  // Configure headers for proxied requests to include timeout information
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
